// ---------------------------------------------------------------------------
// Murder Lab — core game engine (faithful to Deception: Murder in Hong Kong).
//
// One Room instance per active room. The server is the single source of
// truth: clients only ever receive sanitized views of the state.
//
// Phase flow:
//   lobby -> dealing -> killerSelect
//         -> forensic(round 1) -> discussion(1)
//         -> forensic(round 2) -> discussion(2)
//         -> forensic(round 3) -> discussion(3)
//         -> [witnessGuess] -> reveal -> scoreboard
//
// The Forensic Scientist communicates ONLY by placing one bullet marker on
// each of the 6 scene tiles. Each round they may swap one non-fixed tile and
// re-mark it, so the evidence evolves. Any investigator may, at any time,
// spend their single badge on one attempt to "solve the crime".
//
// Roles (host is always the Forensic Scientist). Per the official rules the
// Witness only plays alongside the Accomplice, so neither appears below 6:
//   4–5 : murderer + investigators
//   6+  : murderer + accomplice + witness + investigators
// ---------------------------------------------------------------------------

import crypto from 'crypto';
import { MEANS_POOL, CLUE_POOL, CARD_BY_ID } from './cards.js';
import {
  drawStartingTiles,
  drawReplacementTile,
  ALL_TILES_BY_ID,
  reportLine,
} from './scenetiles.js';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 14;
export const TOTAL_ROUNDS = 3;

// Phase durations in seconds. Forensic / killer / witness phases auto-resolve
// if their timer expires, so nobody can soft-lock the game.
const TIMERS = {
  dealing: 4,
  killerSelect: 75,
  forensic: 150,
  witnessGuess: 60,
};

const INVESTIGATION_PHASES = ['killerSelect', 'forensic', 'discussion', 'witnessGuess'];

/** Fisher–Yates shuffle (returns a new array). */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 4-letter room code, skipping easily-confused letters. */
export function generateRoomCode(taken) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (taken.has(code));
  return code;
}

export class Room {
  constructor(io, code) {
    this.io = io;
    this.code = code;

    /** @type {Array<object>} player records — see addPlayer() for shape */
    this.players = [];

    this.phase = 'lobby';
    this.round = 0;                 // current investigation round (1..3)
    this.discussionSeconds = 180;   // per discussion round
    this.handSize = 4;              // cards of EACH deck per player (3–5)

    // Per-round state
    this.tiles = [];                // the 6 scene tiles in play
    this.tileMarks = {};            // tileId -> optionId chosen by the scientist
    this.swappedTileId = null;      // tile removed this round (rounds 2–3)
    this.newTileId = null;          // tile added this round, awaiting its mark
    this.killerPick = null;         // { meansCardId, clueCardId }
    this.solveAttempts = [];        // public log of solve attempts
    this.pendingSolver = null;      // correct solver awaiting the witness twist
    this.reveal = null;             // end-of-round summary

    this.history = [];              // one entry per finished round
    this.chatLog = [];              // last 100 chat messages (resent on rejoin)

    this.timerHandle = null;
    this.timerEndsAt = null;
    this.pausedRemaining = null;    // seconds left while the host froze the clock
    this.emptySince = null;         // timestamp when the last player disconnected
  }

  // ------------------------------------------------------------------
  // Player management
  // ------------------------------------------------------------------

  addPlayer(name, socketId) {
    if (this.phase !== 'lobby') return { ok: false, error: 'Game already in progress.' };
    if (this.players.length >= MAX_PLAYERS) return { ok: false, error: 'Room is full (14 players max).' };
    const trimmed = String(name || '').trim().slice(0, 20);
    if (!trimmed) return { ok: false, error: 'Please enter a name.' };
    if (this.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'That name is already taken in this room.' };
    }

    const player = {
      id: crypto.randomUUID(),
      token: crypto.randomUUID(), // secret — required to rejoin as this player
      socketId,
      name: trimmed,
      connected: true,
      isHost: this.players.length === 0,
      score: 0,
      // per-round fields
      role: null,               // 'forensic' | 'killer' | 'accomplice' | 'witness' | 'investigator'
      hand: { means: [], clue: [] },
      hasBadge: true,           // spent on the player's single solve attempt
    };
    this.players.push(player);
    this.emptySince = null;
    return { ok: true, player };
  }

  getPlayer(playerId) {
    return this.players.find((p) => p.id === playerId) || null;
  }

  host() {
    return this.players.find((p) => p.isHost) || null;
  }

  byRole(role) {
    return this.players.find((p) => p.role === role) || null;
  }

  connectedPlayers() {
    return this.players.filter((p) => p.connected);
  }

  handleDisconnect(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.connected = false;
    player.socketId = null;
    if (player.isHost) {
      const next = this.connectedPlayers()[0];
      if (next) {
        player.isHost = false;
        next.isHost = true;
        this.systemChat(`${next.name} is now the host.`);
      }
    }
    if (this.connectedPlayers().length === 0) this.emptySince = Date.now();
    this.sync();
  }

  removePlayer(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    if (this.phase === 'lobby') {
      this.players = this.players.filter((p) => p.id !== playerId);
      if (player.isHost && this.players.length > 0) this.players[0].isHost = true;
    } else {
      this.handleDisconnect(playerId);
      return;
    }
    if (this.players.length === 0) this.emptySince = Date.now();
    this.sync();
  }

  rejoin(playerId, token, socketId) {
    const player = this.getPlayer(playerId);
    if (!player || player.token !== token) return { ok: false, error: 'Could not rejoin this room.' };
    player.socketId = socketId;
    player.connected = true;
    this.emptySince = null;
    return { ok: true, player };
  }

  // ------------------------------------------------------------------
  // Timers (with host pause/resume during discussion)
  // ------------------------------------------------------------------

  startTimer(seconds, onExpire) {
    this.clearTimer();
    this.pausedRemaining = null;
    this._onExpire = onExpire;
    this.timerEndsAt = Date.now() + seconds * 1000;
    this.timerHandle = setTimeout(() => {
      this.timerHandle = null;
      this.timerEndsAt = null;
      onExpire();
    }, seconds * 1000);
  }

  clearTimer() {
    if (this.timerHandle) clearTimeout(this.timerHandle);
    this.timerHandle = null;
    this.timerEndsAt = null;
    this.pausedRemaining = null;
    this._onExpire = null;
  }

  destroy() {
    this.clearTimer();
  }

  togglePause(playerId) {
    const player = this.getPlayer(playerId);
    if (!player?.isHost) return { ok: false, error: 'Only the host can pause the timer.' };
    if (this.phase !== 'discussion') return { ok: false, error: 'The timer can only be paused during discussion.' };

    if (this.pausedRemaining != null) {
      const remaining = this.pausedRemaining;
      const onExpire = this._onExpire;
      this.startTimer(remaining, onExpire);
      this.systemChat(`${player.name} resumed the timer.`);
    } else if (this.timerEndsAt) {
      this.pausedRemaining = Math.max(1, Math.ceil((this.timerEndsAt - Date.now()) / 1000));
      if (this.timerHandle) clearTimeout(this.timerHandle);
      this.timerHandle = null;
      this.timerEndsAt = null;
      this.systemChat(`${player.name} paused the timer.`);
    } else {
      return { ok: false, error: 'No timer to pause.' };
    }
    this.sync();
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Round lifecycle
  // ------------------------------------------------------------------

  startRound(byPlayerId, opts = {}) {
    const player = this.getPlayer(byPlayerId);
    if (!player?.isHost) return { ok: false, error: 'Only the host can start the game.' };
    if (!['lobby', 'reveal', 'scoreboard'].includes(this.phase)) {
      return { ok: false, error: 'A round is already in progress.' };
    }
    const active = this.connectedPlayers();
    if (active.length < MIN_PLAYERS) {
      return { ok: false, error: `Need at least ${MIN_PLAYERS} connected players.` };
    }

    if (opts.discussionSeconds) {
      this.discussionSeconds = Math.max(45, Math.min(600, Number(opts.discussionSeconds) || 180));
    }
    if (opts.handSize) {
      this.handSize = Math.max(3, Math.min(5, Number(opts.handSize) || 4));
    }

    // Reset per-round state
    this.round = 0;
    this.tiles = [];
    this.tileMarks = {};
    this.swappedTileId = null;
    this.newTileId = null;
    this.killerPick = null;
    this.solveAttempts = [];
    this.pendingSolver = null;
    this.reveal = null;
    for (const p of this.players) {
      p.role = null;
      p.hand = { means: [], clue: [] };
      p.hasBadge = true;
    }

    // Deal handSize Means + handSize Clue cards to each player.
    const means = shuffle(MEANS_POOL);
    const clues = shuffle(CLUE_POOL);
    active.forEach((p, i) => {
      p.hand = {
        means: means.slice(i * this.handSize, (i + 1) * this.handSize),
        clue: clues.slice(i * this.handSize, (i + 1) * this.handSize),
      };
    });

    // The 6 scene tiles for this game (2 fixed + 4 random).
    this.tiles = drawStartingTiles(shuffle);

    // Roles. The host is always the forensic scientist; the killer team is
    // drawn secretly from everyone else.
    const others = shuffle(active.filter((p) => p.id !== player.id));
    player.role = 'forensic';
    player.hasBadge = false; // the scientist never accuses
    others[0].role = 'killer';
    let i = 1;
    // The witness only plays alongside the accomplice — both appear at 6+.
    if (active.length >= 6) {
      others[i++].role = 'accomplice';
      others[i++].role = 'witness';
    }
    for (; i < others.length; i++) others[i].role = 'investigator';

    this.phase = 'dealing';
    this.systemChat(`New case — dealing ${this.handSize} clue & ${this.handSize} means cards and assigning roles...`);
    this.startTimer(TIMERS.dealing, () => this.beginKillerSelect());
    this.sync();
    return { ok: true };
  }

  beginKillerSelect() {
    this.phase = 'killerSelect';
    this.systemChat('Night falls... the murderer is choosing the means of murder and the key evidence.');
    this.startTimer(TIMERS.killerSelect, () => this.autoKillerPick());
    this.sync();
  }

  // ------------------------------------------------------------------
  // The Crime — murderer picks 1 Means + 1 Clue from their OWN hand
  // ------------------------------------------------------------------

  killerSelect(playerId, meansCardId, clueCardId) {
    const player = this.getPlayer(playerId);
    if (this.phase !== 'killerSelect') return { ok: false, error: 'Not the crime phase.' };
    if (player?.role !== 'killer') return { ok: false, error: 'Only the murderer can do that.' };
    const means = player.hand.means.find((c) => c.id === meansCardId);
    const clue = player.hand.clue.find((c) => c.id === clueCardId);
    if (!means) return { ok: false, error: 'Pick a Means card from your own hand.' };
    if (!clue) return { ok: false, error: 'Pick a Clue card from your own hand.' };
    this.applyKillerPick(meansCardId, clueCardId);
    return { ok: true };
  }

  autoKillerPick() {
    const killer = this.byRole('killer');
    if (!killer) return this.finalizeRound('killer');
    const means = shuffle(killer.hand.means)[0];
    const clue = shuffle(killer.hand.clue)[0];
    this.systemChat('The murderer ran out of time — the crime was committed in a hurry!');
    this.applyKillerPick(means.id, clue.id);
  }

  applyKillerPick(meansCardId, clueCardId) {
    this.killerPick = { meansCardId, clueCardId };
    this.systemChat('A body has been found! The forensic scientist examines the scene...');
    this.beginForensic(1);
  }

  // ------------------------------------------------------------------
  // Forensic phases — place / swap scene-tile markers
  // ------------------------------------------------------------------

  beginForensic(round) {
    this.round = round;
    this.phase = 'forensic';
    this.swappedTileId = null;
    this.newTileId = null;
    if (round === 1) {
      this.systemChat('Round 1 — the forensic scientist is marking the evidence on all six tiles.');
    } else {
      this.systemChat(`Round ${round} — the scientist will revise one piece of evidence.`);
    }
    this.startTimer(TIMERS.forensic, () => this.autoForensic());
    this.sync();
  }

  /** Scientist marks one option on a tile. */
  forensicMark(playerId, tileId, optionId) {
    const player = this.getPlayer(playerId);
    if (this.phase !== 'forensic') return { ok: false, error: 'Not the forensic phase.' };
    if (player?.role !== 'forensic') return { ok: false, error: 'Only the forensic scientist can do that.' };
    const tile = this.tiles.find((t) => t.id === tileId);
    if (!tile) return { ok: false, error: 'That tile is not on the table.' };
    if (!tile.options.some((o) => o.id === optionId)) return { ok: false, error: 'Unknown option.' };
    // In rounds 2–3 the scientist may only (re)mark the freshly swapped tile.
    if (this.round > 1 && tileId !== this.newTileId) {
      return { ok: false, error: 'You can only re-mark the tile you swapped this round.' };
    }
    this.tileMarks[tileId] = optionId;
    this.sync();
    return { ok: true };
  }

  /** Rounds 2–3: swap one non-fixed tile for a fresh one (once per round). */
  forensicSwap(playerId, replaceTileId) {
    const player = this.getPlayer(playerId);
    if (this.phase !== 'forensic') return { ok: false, error: 'Not the forensic phase.' };
    if (player?.role !== 'forensic') return { ok: false, error: 'Only the forensic scientist can do that.' };
    if (this.round < 2) return { ok: false, error: 'Tiles are only swapped from round 2 onward.' };
    if (this.swappedTileId) return { ok: false, error: 'You have already swapped a tile this round.' };
    const idx = this.tiles.findIndex((t) => t.id === replaceTileId);
    if (idx < 0) return { ok: false, error: 'That tile is not on the table.' };
    if (this.tiles[idx].fixed) return { ok: false, error: 'Cause of Death and Location cannot be swapped.' };
    const fresh = drawReplacementTile(shuffle, this.tiles);
    if (!fresh) return { ok: false, error: 'No fresh tiles left to draw.' };
    delete this.tileMarks[replaceTileId];
    this.tiles[idx] = fresh;
    this.swappedTileId = replaceTileId;
    this.newTileId = fresh.id;
    this.systemChat(`The scientist reopens the file on "${ALL_TILES_BY_ID.get(replaceTileId)?.label || 'a clue'}"...`);
    this.sync();
    return { ok: true };
  }

  /** Finish the forensic phase and open discussion. */
  forensicConfirm(playerId) {
    const player = this.getPlayer(playerId);
    if (this.phase !== 'forensic') return { ok: false, error: 'Not the forensic phase.' };
    if (player?.role !== 'forensic') return { ok: false, error: 'Only the forensic scientist can do that.' };
    if (this.round === 1) {
      const missing = this.tiles.filter((t) => !this.tileMarks[t.id]);
      if (missing.length) return { ok: false, error: `Mark all six tiles first (${missing.length} left).` };
    } else {
      if (!this.swappedTileId) return { ok: false, error: 'Swap one tile before continuing.' };
      if (!this.tileMarks[this.newTileId]) return { ok: false, error: 'Mark the new tile before continuing.' };
    }
    this.beginDiscussion(this.round);
    return { ok: true };
  }

  /** Timeout fallback: mark/swap at random so the room never stalls. */
  autoForensic() {
    if (this.round === 1) {
      for (const t of this.tiles) {
        if (!this.tileMarks[t.id]) this.tileMarks[t.id] = t.options[Math.floor(Math.random() * t.options.length)].id;
      }
    } else {
      if (!this.swappedTileId) {
        const swappable = this.tiles.filter((t) => !t.fixed);
        const pick = swappable[Math.floor(Math.random() * swappable.length)];
        const fresh = drawReplacementTile(shuffle, this.tiles);
        if (pick && fresh) {
          const idx = this.tiles.findIndex((t) => t.id === pick.id);
          delete this.tileMarks[pick.id];
          this.tiles[idx] = fresh;
          this.swappedTileId = pick.id;
          this.newTileId = fresh.id;
        }
      }
      if (this.newTileId && !this.tileMarks[this.newTileId]) {
        const t = this.tiles.find((x) => x.id === this.newTileId);
        this.tileMarks[t.id] = t.options[Math.floor(Math.random() * t.options.length)].id;
      }
    }
    this.systemChat('The scientist files the report just in time.');
    this.beginDiscussion(this.round);
  }

  // ------------------------------------------------------------------
  // Discussion phases — everyone debates; investigators may solve
  // ------------------------------------------------------------------

  beginDiscussion(round) {
    this.round = round;
    this.phase = 'discussion';
    this.systemChat(`The evidence is on the table — discuss! (round ${round}/${TOTAL_ROUNDS})`);
    this.startTimer(this.discussionSeconds, () => this.afterDiscussion());
    this.sync();
  }

  afterDiscussion() {
    if (this.round < TOTAL_ROUNDS) this.beginForensic(this.round + 1);
    else this.finalizeRound('killer'); // unsolved after the final round
  }

  /** Host can end the current discussion early. */
  endDiscussion(playerId) {
    const player = this.getPlayer(playerId);
    if (this.phase !== 'discussion') return { ok: false, error: 'Not the discussion phase.' };
    if (!player?.isHost) return { ok: false, error: 'Only the host can advance the round.' };
    this.clearTimer();
    this.afterDiscussion();
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Solving the crime — one badge-spending attempt per player, any time
  // ------------------------------------------------------------------

  solve(playerId, targetId, meansCardId, clueCardId) {
    const player = this.getPlayer(playerId);
    if (!['forensic', 'discussion'].includes(this.phase) && this.phase !== 'killerSelect') {
      // Allowed throughout the investigation, but not before it begins.
      if (!['forensic', 'discussion'].includes(this.phase)) {
        return { ok: false, error: 'You can only solve once the investigation is underway.' };
      }
    }
    if (!player || !player.role) return { ok: false, error: 'You are not part of this round.' };
    if (player.role === 'forensic') return { ok: false, error: 'The forensic scientist cannot solve the crime.' };
    if (!player.hasBadge) return { ok: false, error: 'You already spent your one attempt.' };

    const target = this.getPlayer(targetId);
    if (!target || !target.role || target.role === 'forensic') return { ok: false, error: 'Invalid suspect.' };
    const means = target.hand.means.find((c) => c.id === meansCardId);
    const clue = target.hand.clue.find((c) => c.id === clueCardId);
    if (!means || !clue) return { ok: false, error: "Pick a Means and a Clue card from that suspect's cards." };

    player.hasBadge = false; // spent, win or lose
    const correct =
      target.role === 'killer' &&
      meansCardId === this.killerPick.meansCardId &&
      clueCardId === this.killerPick.clueCardId;

    this.solveAttempts.push({
      byId: player.id,
      byName: player.name,
      suspectId: target.id,
      suspectName: target.name,
      meansCard: CARD_BY_ID.get(meansCardId),
      clueCard: CARD_BY_ID.get(clueCardId),
      correct,
    });

    if (correct) {
      this.systemChat(`${player.name} names ${target.name}: ${means.name} + ${clue.name} — CASE SOLVED!`);
      this.resolveSolvedCase(player);
    } else {
      this.systemChat(`${player.name} accused ${target.name} (${means.name} + ${clue.name}) — the scientist says: "No."`);
      const remaining = this.players.filter(
        (p) => p.role && p.role !== 'forensic' && p.hasBadge && p.connected
      );
      if (remaining.length === 0) this.finalizeRound('killer');
      else this.sync();
    }
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // The reversal — caught murderer guesses the witness
  // ------------------------------------------------------------------

  resolveSolvedCase(solver) {
    const witness = this.byRole('witness');
    const killer = this.byRole('killer');
    if (!witness || !killer?.connected) {
      this.finalizeRound('investigators', solver);
      return;
    }
    this.pendingSolver = solver;
    this.clearTimer();
    this.phase = 'witnessGuess';
    this.systemChat('The case is solved... but the murderer knows someone was watching. One final guess!');
    this.startTimer(TIMERS.witnessGuess, () => this.finalizeRound('investigators', this.pendingSolver));
    this.sync();
  }

  guessWitness(playerId, targetId) {
    const player = this.getPlayer(playerId);
    if (this.phase !== 'witnessGuess') return { ok: false, error: 'Not the witness-guess phase.' };
    if (player?.role !== 'killer') return { ok: false, error: 'Only the murderer can make this guess.' };
    const target = this.getPlayer(targetId);
    if (!target?.role || ['forensic', 'killer', 'accomplice'].includes(target.role)) {
      return { ok: false, error: 'Invalid guess.' };
    }
    const correct = target.role === 'witness';
    const stealGuess = { guessedId: target.id, guessedName: target.name, correct };
    this.systemChat(
      correct
        ? `${player.name} unmasked the witness — ${target.name} saw everything. The murderer escapes!`
        : `${player.name} guessed ${target.name}... who saw nothing. The witness stays hidden.`
    );
    this.finalizeRound(correct ? 'killerSteal' : 'investigators', this.pendingSolver, stealGuess);
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Closing the file — scoring, reveal, history
  // ------------------------------------------------------------------

  finalizeRound(winner, solver = null, stealGuess = null) {
    this.clearTimer();
    this.phase = 'reveal';

    const killer = this.byRole('killer');
    const forensic = this.byRole('forensic');
    const accomplice = this.byRole('accomplice');
    const witness = this.byRole('witness');
    const meansCard = CARD_BY_ID.get(this.killerPick?.meansCardId) || null;
    const clueCard = CARD_BY_ID.get(this.killerPick?.clueCardId) || null;

    if (winner === 'investigators') {
      if (solver) solver.score += 3;
      if (forensic) forensic.score += 2;
      if (witness) witness.score += 2;
      for (const p of this.players) if (p.role === 'investigator' && p !== solver) p.score += 1;
    } else if (winner === 'killer') {
      if (killer) killer.score += 5;
      if (accomplice) accomplice.score += 2;
    } else if (winner === 'killerSteal') {
      if (killer) killer.score += 4;
      if (accomplice) accomplice.score += 2;
    }

    this.reveal = {
      winner,
      killerId: killer?.id || null,
      killerName: killer?.name || '?',
      forensicName: forensic?.name || '?',
      accompliceId: accomplice?.id || null,
      accompliceName: accomplice?.name || null,
      witnessId: witness?.id || null,
      witnessName: witness?.name || null,
      meansCard,
      clueCard,
      solverName: solver?.name || null,
      stealGuess,
    };

    const tileSummary = this.tiles.map((t) => ({
      label: t.label,
      option: t.options.find((o) => o.id === this.tileMarks[t.id])?.label || '—',
    }));

    this.history.push({
      winner,
      killerName: killer?.name || '?',
      accompliceName: accomplice?.name || null,
      witnessName: witness?.name || null,
      meansCard: meansCard?.name || '?',
      clueCard: clueCard?.name || '?',
      solverName: solver?.name || null,
      stealGuess: stealGuess ? { guessedName: stealGuess.guessedName, correct: stealGuess.correct } : null,
      tiles: tileSummary,
      attempts: this.solveAttempts.map((a) => ({
        by: a.byName, suspect: a.suspectName, means: a.meansCard.name, clue: a.clueCard.name, correct: a.correct,
      })),
    });

    const summary = `${killer?.name} was the murderer (${meansCard?.name} + ${clueCard?.name}).`;
    this.systemChat(
      winner === 'investigators'
        ? `The investigators win! ${summary}`
        : winner === 'killerSteal'
        ? `The murderer steals the win by spotting the witness! ${summary}`
        : `The murderer escapes! ${summary}`
    );
    this.sync();
  }

  showScoreboard(playerId) {
    const player = this.getPlayer(playerId);
    if (this.phase !== 'reveal') return { ok: false, error: 'Nothing to show yet.' };
    if (!player?.isHost) return { ok: false, error: 'Only the host can continue.' };
    this.phase = 'scoreboard';
    this.sync();
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Chat (forensic scientist is muted during the investigation)
  // ------------------------------------------------------------------

  chat(playerId, text) {
    const player = this.getPlayer(playerId);
    if (!player) return { ok: false, error: 'Not in this room.' };
    if (player.role === 'forensic' && INVESTIGATION_PHASES.includes(this.phase)) {
      return { ok: false, error: 'The forensic scientist may only speak through the scene tiles!' };
    }
    const clean = String(text || '').trim().slice(0, 300);
    if (!clean) return { ok: false, error: 'Empty message.' };
    this.pushChat({ author: player.name, text: clean, system: false, ts: Date.now() });
    return { ok: true };
  }

  systemChat(text) {
    this.pushChat({ author: 'Murder Lab', text, system: true, ts: Date.now() });
  }

  pushChat(msg) {
    this.chatLog.push(msg);
    if (this.chatLog.length > 100) this.chatLog.shift();
    this.io.to(this.code).emit('chat:message', msg);
  }

  // ------------------------------------------------------------------
  // State views
  // ------------------------------------------------------------------

  /** Generated forensic-report lines from the currently marked tiles. */
  reportLines() {
    return this.tiles
      .filter((t) => this.tileMarks[t.id])
      .map((t) => reportLine(t, t.options.find((o) => o.id === this.tileMarks[t.id]).label));
  }

  /** Whether solve attempts are currently allowed. */
  solvingOpen() {
    return this.phase === 'forensic' || this.phase === 'discussion';
  }

  publicState() {
    const revealVisible = this.phase === 'reveal' || this.phase === 'scoreboard';
    const killerExposed = revealVisible || this.phase === 'witnessGuess';
    return {
      code: this.code,
      phase: this.phase,
      round: this.round,
      totalRounds: TOTAL_ROUNDS,
      hostId: this.host()?.id || null,
      timerEndsAt: this.timerEndsAt,
      pausedRemaining: this.pausedRemaining,
      discussionSeconds: this.discussionSeconds,
      handSize: this.handSize,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      tiles: this.tiles,
      tileMarks: this.tileMarks,
      swappedTileId: this.swappedTileId,
      newTileId: this.newTileId,
      report: this.reportLines(),
      solvingOpen: this.solvingOpen(),
      solveAttempts: this.solveAttempts,
      reveal: revealVisible ? this.reveal : null,
      history: this.history,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        isHost: p.isHost,
        score: p.score,
        hand: p.hand,            // both decks are public, face-up
        hasBadge: p.hasBadge,
        role:
          p.role === 'forensic' || revealVisible || (killerExposed && p.role === 'killer')
            ? p.role
            : null,
      })),
    };
  }

  privateStateFor(player) {
    const state = { playerId: player.id, role: player.role };
    const killer = this.byRole('killer');
    const accomplice = this.byRole('accomplice');

    if (player.role === 'killer') {
      if (this.killerPick) state.killerPick = this.killerPick;
      if (accomplice) {
        state.accompliceId = accomplice.id;
        state.accompliceName = accomplice.name;
      }
    }
    if (player.role === 'forensic' || player.role === 'accomplice') {
      state.killerInfo = {
        killerId: killer?.id || null,
        killerName: killer?.name || null,
        meansCardId: this.killerPick?.meansCardId || null,
        clueCardId: this.killerPick?.clueCardId || null,
      };
    }
    if (player.role === 'witness') {
      state.witnessInfo = {
        killerId: killer?.id || null,
        killerName: killer?.name || null,
        accompliceId: accomplice?.id || null,
        accompliceName: accomplice?.name || null,
      };
    }
    return state;
  }

  sync() {
    this.io.to(this.code).emit('room:state', this.publicState());
    for (const p of this.players) {
      if (p.connected && p.socketId) this.io.to(p.socketId).emit('you', this.privateStateFor(p));
    }
  }
}
