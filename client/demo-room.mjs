// ---------------------------------------------------------------------------
// Demo helper: 3 bots create and fill a room, wait for a 4th human player to
// join (e.g. from a browser), then the bot host starts the game. Bots play
// their roles automatically (killer pick / forensic clues) so the human can
// see every phase. Useful for testing the UI without juggling four tabs.
//
//   node client/demo-room.mjs
// ---------------------------------------------------------------------------

import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';
const NAMES = ['Watson', 'Lestrade', 'Mycroft'];

const emit = (socket, event, payload = {}) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

function connect(name) {
  const socket = io(URL);
  const ctx = { name, socket, state: null, you: null, acted: {} };
  socket.on('room:state', (s) => (ctx.state = s));
  socket.on('you', (y) => (ctx.you = y));
  return ctx;
}

const bots = NAMES.map(connect);
const [host] = bots;

await new Promise((r) => host.socket.on('connect', r));
const created = await emit(host.socket, 'room:create', { name: host.name });
if (!created.ok) throw new Error(created.error);
for (const bot of bots.slice(1)) {
  await emit(bot.socket, 'room:join', { code: created.code, name: bot.name });
}

console.log('================================');
console.log(`ROOM CODE: ${created.code}`);
console.log('Join from a browser, the game starts automatically.');
console.log('================================');

let started = false;
setInterval(async () => {
  for (const bot of bots) {
    const { state, you } = bot;
    if (!state || !you) continue;

    // Host bot: start once a 4th player joins the lobby.
    if (!started && bot === host && state.phase === 'lobby' && state.players.length >= 4) {
      started = true;
      await emit(bot.socket, 'game:start', { discussionSeconds: 180 });
    }
    // Murderer bot: pick one Means + one Clue card.
    if (you.role === 'killer' && state.phase === 'killerSelect' && !bot.acted.kill) {
      bot.acted.kill = true;
      const hand = state.players.find((p) => p.id === you.playerId).hand;
      await emit(bot.socket, 'killer:select', {
        meansCardId: hand.means[0].id,
        clueCardId: hand.clue[0].id,
      });
    }
    // Murderer bot: if caught, take a random guess at the witness.
    if (you.role === 'killer' && state.phase === 'witnessGuess' && !bot.acted.guess) {
      bot.acted.guess = true;
      const candidates = state.players.filter(
        (p) =>
          p.hand.means.length > 0 &&
          p.id !== you.playerId &&
          p.role !== 'forensic' &&
          p.id !== you.accompliceId
      );
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (pick) await emit(bot.socket, 'killer:guessWitness', { targetId: pick.id });
    }
    // Forensic bot: in each forensic phase, mark tiles then confirm.
    if (you.role === 'forensic' && state.phase === 'forensic' && bot.acted.forensicRound !== state.round) {
      bot.acted.forensicRound = state.round;
      if (state.round > 1) {
        const swappable = state.tiles.filter((t) => !t.fixed);
        await emit(bot.socket, 'forensic:swap', { replaceTileId: swappable[0].id });
      }
      // Re-read state after a possible swap.
      for (const tile of bot.state.tiles) {
        if (!bot.state.tileMarks[tile.id]) {
          await emit(bot.socket, 'forensic:mark', { tileId: tile.id, optionId: tile.options[0].id });
        }
      }
      await emit(bot.socket, 'forensic:confirm');
    }
  }
}, 1000);

// Keep bots online for 15 minutes, then let the room clean itself up.
setTimeout(() => process.exit(0), 15 * 60 * 1000);
