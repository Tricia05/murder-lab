// ---------------------------------------------------------------------------
// Murder Lab — core game engine.
//
// One Room instance per active room. The server is the single source of
// truth: clients only ever receive sanitized views of the state.
//
// Phase flow:
//   lobby -> dealing -> killerSelect -> forensicClues
//         -> discussion (3 report waves) -> accusation
//         -> [witnessGuess]            (only if the crime was solved and a
//         -> reveal -> scoreboard       witness is in play: the killer gets
//                                       one guess to silence the witness)
//
// Roles by player count (host is always the forensic scientist):
//   4    : killer + 2 investigators
//   5    : killer + witness + 2 investigators
//   6+   : killer + accomplice + witness + investigators
// ---------------------------------------------------------------------------

import crypto from 'crypto';
import { CARD_POOL, CARD_BY_ID } from './cards.js';
import { drawActiveCategories, buildReport } from './clues.js';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 14;
export const HAND_SIZE = 5;
export const TOTAL_WAVES = 3;

// Phase durations in seconds. Killer / forensic / witness-guess phases
// auto-resolve if the timer expires, so nobody can soft-lock the game.
const TIMERS = {
  dealing: 4,
  killerSelect: 75,
  forensicClues: 180,
  accusation: 120,
  witnessGuess: 60,
};

const ROUND_ACTIVE_PHASES = ['killerSelect', 'forensicClues', 'discussion', 'accusation', 'witnessGuess'];
const MARKER_PHASES = ['discussion', 'accusation'];
const MAX_MARKERS_PER_PLAYER = 2;

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
    this.round = 0;
    this.discussionSeconds = 360; // total across the 3 waves

    // Per-round state
    this.activeCategories = []; // this round's 8 clue categories
    this.killerPick = null;     // { methodCardId, evidenceCardId }
    this.fullClues = null;      // scientist's selections for ALL active categories
    this.publishedClues = {};   // subset revealed so far (by wave)
    this.reports = [];          // generated crime-report sections, one per wave
    this.wave = 0;              // current discussion wave (1..3)
    this.accusations = [];      // public log of accusations this round
    this.markers = [];          // suspicion markers: { byId, byName, targetId }
    this.pendingAccuser = null; // correct accuser awaiting the witness-guess twist
    this.reveal = null;         // end-of-round summary

    this.history = [];          // one entry per finished round
    this.chatLog = [];          // last 100 chat messages (resent on rejoin)

    this.timerHandle = null;
    this.timerEndsAt = null;
    this.pausedRemaining = null; // seconds left while the host has the clock frozen
    this.emptySince = null;     // timestamp when the last player disconnected
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
      role: null,               // 'killer' | 'forensic' | 'accomplice' | 'witness' | 'investigator' | null
      hand: [],                 // array of card objects
      hasAccused: false,
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

  /** Mark a player disconnected; hand host to someone else if needed. */
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

  /** Explicit leave. In the lobby the player is removed entirely. */
  removePlayer(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    if (this.phase === 'lobby') {
      this.players = this.players.filter((p) => p.id !== playerId);
      if (player.isHost && this.players.length > 0) this.players[0].isHost = true;
    } else {
      this.handleDisconnect(playerId);
      return; // handleDisconnect already synced
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
  // Timers
  // ------------------------------------------------------------------

  startTimer(seconds, onExpire) {
    this.clearTimer();
    this.pausedRemaining = null;
    this.timerEndsAt = Date.now() + seconds * 1000;
    this.timerHandle = setTimeout(() => {
      this.timerHandle = null;
      this.timerEndsAt = null;
      onExpire();
    }, seconds * 1000);
  }

  /**
   * Host control: freeze/unfreeze the clock during discussion or the
   * accusation phase, so the table can take the time it needs — or stop
   * waiting once everyone is ready to accuse.
   */
  togglePause(playerId) {
    const player = this.getPlayer(playerId);
    if (!player?.isHost) return { ok: false, error: 'Only the host can pause the timer.' };
    if (!['discussion', 'accusation'].includes(this.phase)) {
      return { ok: false, error: 'The timer can only be paused during discussion and accusations.' };
    }

    if (this.pausedRemaining != null) {
      // Resume with the remaining time; the expiry action depends on phase.
      const remaining = this.pausedRemaining;
      const onExpire =
        this.phase === 'discussion' ? () => this.beginAccusation() : () => this.finalizeRound('killer');
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

  clearTimer() {
    if (this.timerHandle) clearTimeout(this.timerHandle);
    this.timerHandle = null;
    this.timerEndsAt = null;
    this.pausedRemaining = null;
  }

  /** Called when the room is deleted so no timers fire afterwards. */
  destroy() {
    this.clearTimer();
  }

  // ------------------------------------------------------------------
  // Round lifecycle
  // ------------------------------------------------------------------

  startRound(byPlayerId, discussionSeconds) {
    const player = this.getPlayer(byPlayerId);
    if (!player?.isHost) return { ok: false, error: 'Only the host can start the game.' };
    if (!['lobby', 'reveal', 'scoreboard'].includes(this.phase)) {
      return { ok: false, error: 'A round is already in progress.' };
    }
    const active = this.connectedPlayers();
    if (active.length < MIN_PLAYERS) {
      return { ok: false, error: `Need at least ${MIN_PLAYERS} connected players.` };
    }

    if (discussionSeconds) {
      this.discussionSeconds = Math.max(90, Math.min(900, Number(discussionSeconds) || 360));
    }

    // Reset per-round state
    this.round += 1;
    this.killerPick = null;
    this.fullClues = null;
    this.publishedClues = {};
    this.reports = [];
    this.wave = 0;
    this.accusations = [];
    this.markers = [];
    this.pendingAccuser = null;
    this.reveal = null;
    for (const p of this.players) {
      p.role = null;
      p.hand = [];
      p.hasAccused = false;
    }

    // Draw this round's clue categories (4 core + 4 random).
    this.activeCategories = drawActiveCategories(shuffle);

    // Roles. The host is always the forensic scientist (their identity is
    // public anyway); the killer team is drawn secretly from everyone else.
    //   5 players  -> + witness
    //   6+ players -> + accomplice and witness
    const others = shuffle(active.filter((p) => p.id !== player.id));
    player.role = 'forensic';
    others[0].role = 'killer';
    let i = 1;
    if (active.length >= 6) others[i++].role = 'accomplice';
    if (active.length >= 5) others[i++].role = 'witness';
    for (; i < others.length; i++) others[i].role = 'investigator';

    this.dealHands([player, ...others]);

    this.phase = 'dealing';
    this.systemChat(`Round ${this.round} — dealing cards and assigning roles...`);
    this.startTimer(TIMERS.dealing, () => this.beginKillerSelect());
    this.sync();
    return { ok: true };
  }

  /**
   * Deal 5 cards to each player in the round, re-shuffling until every hand
   * holds at least two method-eligible cards — so EVERY player is a
   * plausible killer and no one is cleared for free by a bad deal.
   */
  dealHands(order) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const deck = shuffle(CARD_POOL);
      const hands = order.map((_, i) => deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE));
      if (hands.every((hand) => hand.filter((c) => c.methodOk).length >= 2)) {
        order.forEach((p, i) => (p.hand = hands[i]));
        return;
      }
    }
    // Statistically unreachable (52 of 72 cards are method-eligible), but
    // never leave players without cards.
    const deck = shuffle(CARD_POOL);
    order.forEach((p, i) => (p.hand = deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE)));
  }

  beginKillerSelect() {
    this.phase = 'killerSelect';
    this.systemChat('Night falls... the killer is choosing a murder method and key evidence.');
    this.startTimer(TIMERS.killerSelect, () => this.autoKillerPick());
    this.sync();
  }

  // ------------------------------------------------------------------
  // Killer selection
  // ------------------------------------------------------------------

  killerSelect(playerId, methodCardId, evidenceCardId) {
    const player = this.getPlayer(playerId);
    if (this.phase !== 'killerSelect') return { ok: false, error: 'Not the killer-selection phase.' };
    if (player?.role !== 'killer') return { ok: false, error: 'Only the killer can do that.' };
    if (methodCardId === evidenceCardId) return { ok: false, error: 'Method and evidence must be different cards.' };
    const method = player.hand.find((c) => c.id === methodCardId);
    const evidence = player.hand.find((c) => c.id === evidenceCardId);
    if (!method || !evidence) return { ok: false, error: 'You can only pick cards from your own hand.' };
    if (!method.methodOk) return { ok: false, error: `${method.name} could not plausibly kill anyone — pick a lethal method.` };
    this.applyKillerPick(methodCardId, evidenceCardId);
    return { ok: true };
  }

  /** Fallback if the killer never confirms in time: pick valid cards at random. */
  autoKillerPick() {
    const killer = this.byRole('killer');
    if (!killer || killer.hand.length < 2) {
      this.finalizeRound('killer'); // shouldn't happen; never leave the room stuck
      return;
    }
    const method = shuffle(killer.hand.filter((c) => c.methodOk))[0] || killer.hand[0];
    const evidence = shuffle(killer.hand.filter((c) => c.id !== method.id))[0];
    this.systemChat('The killer ran out of time — the crime was committed in a hurry!');
    this.applyKillerPick(method.id, evidence.id);
  }

  applyKillerPick(methodCardId, evidenceCardId) {
    this.killerPick = { methodCardId, evidenceCardId };
    this.phase = 'forensicClues';
    this.systemChat('A body has been found! The forensic scientist is preparing the report...');
    this.startTimer(TIMERS.forensicClues, () => this.autoForensicClues());
    this.sync();
  }

  // ------------------------------------------------------------------
  // Forensic clue selection
  // ------------------------------------------------------------------

  forensicSubmit(playerId, selections) {
    const player = this.getPlayer(playerId);
    if (this.phase !== 'forensicClues') return { ok: false, error: 'Not the clue-selection phase.' };
    if (player?.role !== 'forensic') return { ok: false, error: 'Only the forensic scientist can do that.' };

    // Validate: exactly one valid option for every ACTIVE category. No free
    // text — anything that isn't a known option id is rejected.
    const clean = {};
    for (const cat of this.activeCategories) {
      const optionId = selections?.[cat.id];
      if (!cat.options.some((o) => o.id === optionId)) {
        return { ok: false, error: `Pick one option for "${cat.label}".` };
      }
      clean[cat.id] = optionId;
    }
    this.applyClues(clean);
    return { ok: true };
  }

  /** Fallback if the forensic scientist times out: random option per category. */
  autoForensicClues() {
    const clean = {};
    for (const cat of this.activeCategories) {
      clean[cat.id] = cat.options[Math.floor(Math.random() * cat.options.length)].id;
    }
    this.systemChat('The forensic report was rushed — some findings may be... imprecise.');
    this.applyClues(clean);
  }

  /** The full report publishes at once: every clue and all three report
   *  sections are revealed together, and accusations open immediately. */
  applyClues(clues) {
    this.fullClues = clues;
    this.phase = 'discussion';
    this.wave = TOTAL_WAVES;
    this.publishedClues = { ...clues };
    this.reports = [1, 2, 3].map((w) => buildReport(w, this.activeCategories, clues));
    const mins = Math.round(this.discussionSeconds / 60);
    this.systemChat(
      `The full forensic report is in — accusations are open! Discuss the evidence — ` +
      `${mins} minute${mins === 1 ? '' : 's'} on the clock.`
    );
    this.startTimer(this.discussionSeconds, () => this.beginAccusation());
    this.sync();
  }

  /** Host can cut the discussion short. */
  endDiscussion(playerId) {
    const player = this.getPlayer(playerId);
    if (this.phase !== 'discussion') return { ok: false, error: 'Not the discussion phase.' };
    if (!player?.isHost) return { ok: false, error: 'Only the host can end the discussion.' };
    this.beginAccusation();
    return { ok: true };
  }

  beginAccusation() {
    this.phase = 'accusation';
    this.systemChat('Time for final accusations! Each investigator gets exactly one.');
    this.startTimer(TIMERS.accusation, () => this.finalizeRound('killer'));
    this.sync();
  }

  // ------------------------------------------------------------------
  // Suspicion markers
  // ------------------------------------------------------------------

  toggleMarker(playerId, targetId) {
    const player = this.getPlayer(playerId);
    if (!MARKER_PHASES.includes(this.phase)) return { ok: false, error: 'Markers can be placed during discussion and accusations.' };
    if (!player?.role || player.role === 'forensic') return { ok: false, error: 'The forensic scientist points with clues, not markers.' };
    const target = this.getPlayer(targetId);
    if (!target?.role || target.role === 'forensic') return { ok: false, error: 'Invalid target.' };
    if (target.id === player.id) return { ok: false, error: 'You cannot mark yourself.' };

    const existing = this.markers.findIndex((m) => m.byId === player.id && m.targetId === targetId);
    if (existing >= 0) {
      this.markers.splice(existing, 1); // toggle off
    } else {
      const mine = this.markers.filter((m) => m.byId === player.id);
      if (mine.length >= MAX_MARKERS_PER_PLAYER) {
        this.markers.splice(this.markers.indexOf(mine[0]), 1); // oldest moves
      }
      this.markers.push({ byId: player.id, byName: player.name, targetId });
    }
    this.sync();
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Accusations
  // ------------------------------------------------------------------

  /** Accusations open in discussion wave 2+ and during the accusation phase. */
  accusationsOpen() {
    if (this.phase === 'accusation') return true;
    return this.phase === 'discussion' && this.wave >= 2;
  }

  accuse(playerId, suspectId, methodCardId, evidenceCardId) {
    const player = this.getPlayer(playerId);
    if (!this.accusationsOpen()) {
      return { ok: false, error: 'Accusations unlock with the second report (wave 2).' };
    }
    if (!player || !player.role) return { ok: false, error: 'You are not part of this round.' };
    if (player.role === 'forensic') return { ok: false, error: 'The forensic scientist cannot accuse.' };
    if (player.hasAccused) return { ok: false, error: 'You already used your accusation.' };

    const suspect = this.getPlayer(suspectId);
    if (!suspect || !suspect.role) return { ok: false, error: 'Invalid suspect.' };
    if (suspect.id === player.id) return { ok: false, error: 'You cannot accuse yourself.' };
    if (suspect.role === 'forensic') return { ok: false, error: 'The forensic scientist cannot be a suspect.' };
    if (methodCardId === evidenceCardId) return { ok: false, error: 'Pick two different cards.' };
    const method = suspect.hand.find((c) => c.id === methodCardId);
    const evidence = suspect.hand.find((c) => c.id === evidenceCardId);
    if (!method || !evidence) return { ok: false, error: "Both cards must come from the suspect's hand." };
    if (!method.methodOk) return { ok: false, error: `${method.name} is not a plausible murder method.` };

    player.hasAccused = true;
    const correct =
      suspect.role === 'killer' &&
      methodCardId === this.killerPick.methodCardId &&
      evidenceCardId === this.killerPick.evidenceCardId;

    this.accusations.push({
      byId: player.id,
      byName: player.name,
      suspectId: suspect.id,
      suspectName: suspect.name,
      methodCard: CARD_BY_ID.get(methodCardId),
      evidenceCard: CARD_BY_ID.get(evidenceCardId),
      correct,
    });

    if (correct) {
      this.systemChat(`${player.name} accused ${suspect.name} — CASE SOLVED!`);
      this.resolveSolvedCase(player);
    } else {
      this.systemChat(
        `${player.name} accused ${suspect.name} of using ${method.name} with ${evidence.name} — WRONG.`
      );
      // Killer wins early if every eligible player has spent their accusation.
      const pending = this.players.filter(
        (p) => p.role && p.role !== 'forensic' && !p.hasAccused && p.connected
      );
      if (pending.length === 0) {
        this.finalizeRound('killer');
      } else {
        this.sync();
      }
    }
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // The twist: the killer's final guess at the witness
  // ------------------------------------------------------------------

  /** The crime was solved — but if a witness is in play, the killer gets one
   *  chance to identify them and steal the win for the killer team. */
  resolveSolvedCase(accuser) {
    const witness = this.byRole('witness');
    const killer = this.byRole('killer');
    if (!witness || !killer?.connected) {
      this.finalizeRound('investigators', accuser);
      return;
    }
    this.pendingAccuser = accuser;
    this.phase = 'witnessGuess';
    this.systemChat('The case is solved... but the killer knows someone was watching. One final guess!');
    this.startTimer(TIMERS.witnessGuess, () => this.finalizeRound('investigators', this.pendingAccuser));
    this.sync();
  }

  guessWitness(playerId, targetId) {
    const player = this.getPlayer(playerId);
    if (this.phase !== 'witnessGuess') return { ok: false, error: 'Not the witness-guess phase.' };
    if (player?.role !== 'killer') return { ok: false, error: 'Only the killer can make this guess.' };
    const target = this.getPlayer(targetId);
    if (!target?.role || ['forensic', 'killer', 'accomplice'].includes(target.role)) {
      return { ok: false, error: 'Invalid guess.' };
    }
    const correct = target.role === 'witness';
    const stealGuess = { guessedId: target.id, guessedName: target.name, correct };
    this.systemChat(
      correct
        ? `${player.name} unmasked the witness — ${target.name} saw everything. The killer team escapes!`
        : `${player.name} guessed ${target.name}... who saw nothing. The witness stays hidden.`
    );
    this.finalizeRound(correct ? 'killerSteal' : 'investigators', this.pendingAccuser, stealGuess);
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // End of round, scoring, history
  // ------------------------------------------------------------------

  finalizeRound(winner, accuser = null, stealGuess = null) {
    this.clearTimer();
    this.phase = 'reveal';

    const killer = this.byRole('killer');
    const forensic = this.byRole('forensic');
    const accomplice = this.byRole('accomplice');
    const witness = this.byRole('witness');
    const methodCard = CARD_BY_ID.get(this.killerPick?.methodCardId) || null;
    const evidenceCard = CARD_BY_ID.get(this.killerPick?.evidenceCardId) || null;

    // Scoring:
    //   investigators win : accuser +3, forensic +2, witness +2, other investigators +1
    //   killer escapes    : killer +5, accomplice +2
    //   witness unmasked  : killer +4, accomplice +2 (the steal)
    if (winner === 'investigators') {
      if (accuser) accuser.score += 3;
      if (forensic) forensic.score += 2;
      if (witness) witness.score += 2;
      for (const p of this.players) {
        if (p.role === 'investigator' && p !== accuser) p.score += 1;
      }
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
      methodCard,
      evidenceCard,
      accuserName: accuser?.name || null,
      stealGuess,
    };

    // Human-readable clue list for the history panel.
    const clueList = this.activeCategories.map((cat) => ({
      category: cat.label,
      option: cat.options.find((o) => o.id === this.fullClues?.[cat.id])?.label || '—',
    }));

    this.history.push({
      round: this.round,
      winner,
      killerName: killer?.name || '?',
      accompliceName: accomplice?.name || null,
      witnessName: witness?.name || null,
      methodCard: methodCard?.name || '?',
      evidenceCard: evidenceCard?.name || '?',
      accuserName: accuser?.name || null,
      stealGuess: stealGuess ? { guessedName: stealGuess.guessedName, correct: stealGuess.correct } : null,
      clues: clueList,
      accusations: this.accusations.map((a) => ({
        by: a.byName,
        suspect: a.suspectName,
        method: a.methodCard.name,
        evidence: a.evidenceCard.name,
        correct: a.correct,
      })),
    });

    const summary = `${killer?.name} was the killer (${methodCard?.name} + ${evidenceCard?.name}).`;
    this.systemChat(
      winner === 'investigators'
        ? `The investigators win! ${summary}`
        : winner === 'killerSteal'
        ? `The killer team steals the win! ${summary}`
        : `The killer escapes! ${summary}`
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
  // Chat
  // ------------------------------------------------------------------

  chat(playerId, text) {
    const player = this.getPlayer(playerId);
    if (!player) return { ok: false, error: 'Not in this room.' };
    // Rule enforcement: the forensic scientist may only communicate through
    // the clue board while a round is live.
    if (player.role === 'forensic' && ROUND_ACTIVE_PHASES.includes(this.phase)) {
      return { ok: false, error: 'The forensic scientist may only speak through the clue board!' };
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

  /** Everything every player is allowed to see. */
  publicState() {
    const revealVisible = this.phase === 'reveal' || this.phase === 'scoreboard';
    // Markers grouped by target for easy rendering.
    const markersByTarget = {};
    for (const m of this.markers) {
      (markersByTarget[m.targetId] ||= []).push(m.byName);
    }
    return {
      code: this.code,
      phase: this.phase,
      round: this.round,
      hostId: this.host()?.id || null,
      timerEndsAt: this.timerEndsAt,
      pausedRemaining: this.pausedRemaining,
      discussionSeconds: this.discussionSeconds,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      wave: this.wave,
      totalWaves: TOTAL_WAVES,
      // Only this round's active categories travel to clients.
      clueCategories: this.activeCategories.map(({ id, label, tier, wave, options }) => ({ id, label, tier, wave, options })),
      clues: this.publishedClues,
      reports: this.reports,
      accusationsOpen: this.accusationsOpen(),
      accusations: this.accusations,
      reveal: revealVisible ? this.reveal : null,
      history: this.history,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        isHost: p.isHost,
        score: p.score,
        hand: p.hand,            // hands are public in Murder Lab
        hasAccused: p.hasAccused,
        markers: markersByTarget[p.id] || [],
        // The forensic scientist's identity is public (they present the
        // report). The killer is exposed once caught (witnessGuess phase);
        // everything else stays hidden until the reveal.
        role:
          p.role === 'forensic' || revealVisible || (this.phase === 'witnessGuess' && p.role === 'killer')
            ? p.role
            : null,
      })),
    };
  }

  /** Secrets only this player may see. */
  privateStateFor(player) {
    const state = { playerId: player.id, role: player.role };
    const killer = this.byRole('killer');
    const accomplice = this.byRole('accomplice');

    if (player.role === 'killer') {
      if (this.killerPick) state.killerPick = this.killerPick;
      if (accomplice) state.accompliceId = accomplice.id;
      if (accomplice) state.accompliceName = accomplice.name;
    }
    // The accomplice and the forensic scientist both know the killer and the
    // chosen cards (the accomplice helped plan the crime).
    if (player.role === 'forensic' || player.role === 'accomplice') {
      state.killerInfo = {
        killerId: killer?.id || null,
        killerName: killer?.name || null,
        methodCardId: this.killerPick?.methodCardId || null,
        evidenceCardId: this.killerPick?.evidenceCardId || null,
      };
    }
    // The witness knows WHO — never the cards.
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

  /** Broadcast the public state to the room and each player's secrets to them. */
  sync() {
    this.io.to(this.code).emit('room:state', this.publicState());
    for (const p of this.players) {
      if (p.connected && p.socketId) {
        this.io.to(p.socketId).emit('you', this.privateStateFor(p));
      }
    }
  }
}
