// ---------------------------------------------------------------------------
// End-to-end smoke tests against a running server (http://localhost:3001).
//
//   node client/smoke-test.mjs
//
// Scenario A (4 players): two card decks, fair deal, forensic tile marking,
//                         3-round tile swaps, badge-based solving, scoring.
// Scenario B (6 players): accomplice + witness knowledge web and the steal.
// ---------------------------------------------------------------------------

import assert from 'node:assert';
import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';
const emit = (socket, event, payload = {}) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

function waitFor(pred, desc, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const iv = setInterval(() => { if (pred()) { clearInterval(iv); clearTimeout(to); resolve(); } }, 80);
    const to = setTimeout(() => { clearInterval(iv); reject(new Error(`Timed out waiting for: ${desc}`)); }, timeout);
  });
}

function connect(name) {
  const socket = io(URL);
  const ctx = { name, socket, state: null, you: null };
  socket.on('room:state', (s) => (ctx.state = s));
  socket.on('you', (y) => (ctx.you = y));
  return ctx;
}

const ok = (label) => console.log(`  ✔ ${label}`);

async function setupRoom(names, opts) {
  const players = names.map(connect);
  const [host, ...rest] = players;
  await waitFor(() => players.every((p) => p.socket.connected), 'sockets connected');
  const created = await emit(host.socket, 'room:create', { name: host.name });
  assert(created.ok, 'room created');
  for (const p of rest) assert((await emit(p.socket, 'room:join', { code: created.code, name: p.name })).ok, `${p.name} joined`);
  await waitFor(() => host.state?.players.length === names.length, 'all in lobby');
  assert((await emit(host.socket, 'game:start', opts)).ok);
  await waitFor(() => players.every((p) => p.you?.role), 'roles assigned');
  await waitFor(() => host.state.phase === 'killerSelect', 'killerSelect phase');
  return { players, host, code: created.code };
}

const handOf = (host, ctx) => host.state.players.find((pl) => pl.id === ctx.you.playerId).hand;

async function forensicMarkAll(host, fs) {
  for (const tile of host.state.tiles) {
    assert((await emit(fs.socket, 'forensic:mark', { tileId: tile.id, optionId: tile.options[0].id })).ok, `mark ${tile.label}`);
  }
  assert((await emit(fs.socket, 'forensic:confirm')).ok, 'forensic confirm');
}

// ===========================================================================
console.log('Scenario A — 4 players, core loop');
{
  const { players, host } = await setupRoom(['Alice', 'Bob', 'Cara', 'Dan'], { discussionSeconds: 120, handSize: 4 });
  const killer = players.find((p) => p.you.role === 'killer');
  const forensic = players.find((p) => p.you.role === 'forensic');
  const invs = players.filter((p) => p.you.role === 'investigator');
  assert(forensic === host, 'host is the forensic scientist');
  assert(killer && invs.length === 2, '1 killer + 2 investigators');
  assert(host.state.players.every((pl) => pl.hand.means.length === 4 && pl.hand.clue.length === 4), 'each hand has 4 means + 4 clue');
  // uniqueness across all hands
  const allMeans = host.state.players.flatMap((pl) => pl.hand.means.map((c) => c.id));
  assert(new Set(allMeans).size === allMeans.length, 'no duplicate Means cards dealt');
  assert(host.state.tiles.length === 6, '6 scene tiles in play');
  assert(host.state.tiles.filter((t) => t.fixed).length === 2, '2 fixed tiles (Cause of Death + Location)');
  ok('two decks dealt, 6 tiles (2 fixed) laid out');

  const inv = invs[0];
  assert(!inv.you.killerInfo && !inv.you.killerPick && !inv.you.witnessInfo, 'investigator knows nothing');
  ok('information secrecy verified');

  // The Crime
  const kHand = handOf(host, killer);
  const means = kHand.means[0], clue = kHand.clue[0];
  assert((await emit(killer.socket, 'killer:select', { meansCardId: means.id, clueCardId: clue.id })).ok);
  await waitFor(() => host.state.phase === 'forensic' && host.state.round === 1, 'forensic round 1');
  assert(forensic.you.killerInfo?.meansCardId === means.id && forensic.you.killerInfo?.clueCardId === clue.id, 'forensic sees the solution');
  ok(`murderer chose ${means.name} + ${clue.name}; scientist sees it`);

  // Forensic round 1: only the scientist may mark
  const badMark = await emit(inv.socket, 'forensic:mark', { tileId: host.state.tiles[0].id, optionId: host.state.tiles[0].options[0].id });
  assert(badMark.ok === false, 'non-scientist cannot mark tiles');
  const earlyConfirm = await emit(forensic.socket, 'forensic:confirm');
  assert(earlyConfirm.ok === false, 'cannot confirm before all tiles marked');
  await forensicMarkAll(host, forensic);
  await waitFor(() => host.state.phase === 'discussion' && host.state.round === 1, 'discussion round 1');
  assert(Object.keys(host.state.tileMarks).length === 6, 'all 6 markers placed');
  assert(host.state.report.length === 6, 'forensic report generated from markers');
  ok(`6 markers placed; report: "${host.state.report[0]}"`);

  // Chat rule + wrong solve
  assert((await emit(forensic.socket, 'chat:send', { text: 'psst' })).ok === false, 'forensic muted');
  const suspect0 = host.state.players.find((pl) => pl.id === invs[1].you.playerId);
  const wrong = await emit(inv.socket, 'player:solve', { suspectId: suspect0.id, meansCardId: suspect0.hand.means[0].id, clueCardId: suspect0.hand.clue[0].id });
  assert(wrong.ok, 'wrong solve accepted');
  await waitFor(() => host.state.solveAttempts.length === 1 && host.state.solveAttempts[0].correct === false, 'wrong attempt logged');
  assert((await emit(inv.socket, 'player:solve', { suspectId: suspect0.id, meansCardId: suspect0.hand.means[0].id, clueCardId: suspect0.hand.clue[0].id })).ok === false, 'badge already spent');
  ok('badge solve: wrong attempt logged, one attempt per player enforced');

  // Advance to round 2 and test the tile swap
  assert((await emit(host.socket, 'discussion:end')).ok);
  await waitFor(() => host.state.phase === 'forensic' && host.state.round === 2, 'forensic round 2');
  const fixedTile = host.state.tiles.find((t) => t.fixed);
  assert((await emit(forensic.socket, 'forensic:swap', { replaceTileId: fixedTile.id })).ok === false, 'cannot swap a fixed tile');
  const swapTile = host.state.tiles.find((t) => !t.fixed);
  assert((await emit(forensic.socket, 'forensic:swap', { replaceTileId: swapTile.id })).ok, 'swapped a non-fixed tile');
  await waitFor(() => host.state.newTileId && host.state.swappedTileId === swapTile.id, 'new tile drawn');
  const newTile = host.state.tiles.find((t) => t.id === host.state.newTileId);
  assert((await emit(forensic.socket, 'forensic:mark', { tileId: newTile.id, optionId: newTile.options[0].id })).ok, 'marked new tile');
  assert((await emit(forensic.socket, 'forensic:confirm')).ok, 'confirmed round 2');
  await waitFor(() => host.state.phase === 'discussion' && host.state.round === 2, 'discussion round 2');
  ok('round 2 tile swap + re-mark works');

  // Correct solve by the other investigator
  const correct = await emit(invs[1].socket, 'player:solve', { suspectId: killer.you.playerId, meansCardId: means.id, clueCardId: clue.id });
  assert(correct.ok, 'correct solve accepted');
  await waitFor(() => host.state.phase === 'reveal', 'reveal (no witness at 4p)');
  assert(host.state.reveal.winner === 'investigators', 'investigators win');
  const score = (ctx) => host.state.players.find((pl) => pl.id === ctx.you.playerId).score;
  assert.equal(score(invs[1]), 3, 'solver +3');
  assert.equal(score(forensic), 2, 'forensic +2');
  assert.equal(score(invs[0]), 1, 'other investigator +1');
  assert.equal(score(killer), 0, 'killer 0');
  ok('case solved — scoring correct');

  assert((await emit(host.socket, 'game:scoreboard')).ok);
  await waitFor(() => host.state.phase === 'scoreboard', 'scoreboard');
  assert((await emit(host.socket, 'round:next')).ok);
  await waitFor(() => host.state.phase !== 'scoreboard', 'next round started');
  assert.equal(host.state.history.length, 1, 'history recorded');
  ok('next round started, history recorded');

  players.forEach((p) => p.socket.disconnect());
}

// ===========================================================================
console.log('\nScenario B — 6 players: accomplice, witness, the steal');
{
  const { players, host } = await setupRoom(['Holmes', 'Eve', 'Finn', 'Gina', 'Hugo', 'Ivy'], { discussionSeconds: 120, handSize: 4 });
  const killer = players.find((p) => p.you.role === 'killer');
  const accomplice = players.find((p) => p.you.role === 'accomplice');
  const witness = players.find((p) => p.you.role === 'witness');
  const invs = players.filter((p) => p.you.role === 'investigator');
  assert(killer && accomplice && witness && invs.length === 2, 'roles: killer, accomplice, witness, 2 invs');
  assert(witness.you.witnessInfo.killerId === killer.you.playerId, 'witness knows the killer');
  assert(witness.you.witnessInfo.accompliceId === accomplice.you.playerId, 'witness knows the accomplice');
  assert(!witness.you.killerInfo, 'witness does NOT see the cards');
  ok('6-player roles; witness knows WHO, not the cards');

  const kHand = handOf(host, killer);
  const means = kHand.means[0], clue = kHand.clue[0];
  assert((await emit(killer.socket, 'killer:select', { meansCardId: means.id, clueCardId: clue.id })).ok);
  await waitFor(() => host.state.phase === 'forensic', 'forensic');
  assert(killer.you.accompliceId === accomplice.you.playerId, 'killer knows the accomplice');
  assert(accomplice.you.killerInfo?.meansCardId === means.id, 'accomplice sees the full solution');
  ok('knowledge web verified');

  await forensicMarkAll(host, host);
  await waitFor(() => host.state.phase === 'discussion', 'discussion');

  // Correct solve → witness guess
  assert((await emit(invs[0].socket, 'player:solve', { suspectId: killer.you.playerId, meansCardId: means.id, clueCardId: clue.id })).ok, 'correct solve');
  await waitFor(() => host.state.phase === 'witnessGuess', 'witnessGuess phase');
  assert(host.state.players.find((pl) => pl.id === killer.you.playerId).role === 'killer', 'killer exposed during final guess');
  assert((await emit(invs[0].socket, 'killer:guessWitness', { targetId: witness.you.playerId })).ok === false, 'non-killer cannot guess');
  assert((await emit(killer.socket, 'killer:guessWitness', { targetId: accomplice.you.playerId })).ok === false, 'accomplice not a valid guess');
  assert((await emit(killer.socket, 'killer:guessWitness', { targetId: witness.you.playerId })).ok, 'killer guesses the witness');
  await waitFor(() => host.state.phase === 'reveal', 'reveal');
  assert(host.state.reveal.winner === 'killerSteal', 'killer team steals the win');
  const score = (ctx) => host.state.players.find((pl) => pl.id === ctx.you.playerId).score;
  assert.equal(score(killer), 4, 'killer +4 (steal)');
  assert.equal(score(accomplice), 2, 'accomplice +2');
  ok('steal works; scoring correct');

  players.forEach((p) => p.socket.disconnect());
}

// ===========================================================================
console.log('\nScenario C — 5 players: no accomplice, no witness (official rule)');
{
  const { players } = await setupRoom(['Ada', 'Ben', 'Cy', 'Di', 'Ed'], { discussionSeconds: 60, handSize: 4 });
  const roles = players.map((p) => p.you.role).sort();
  const witness = players.find((p) => p.you.role === 'witness');
  const accomplice = players.find((p) => p.you.role === 'accomplice');
  assert(!witness, 'no witness at 5 players');
  assert(!accomplice, 'no accomplice at 5 players');
  assert(players.filter((p) => p.you.role === 'killer').length === 1, 'exactly one murderer');
  assert(players.filter((p) => p.you.role === 'forensic').length === 1, 'exactly one scientist');
  assert(players.filter((p) => p.you.role === 'investigator').length === 3, '3 investigators');
  ok(`5-player roles correct: ${roles.join(', ')}`);
  players.forEach((p) => p.socket.disconnect());
}

console.log('\nALL SMOKE TESTS PASSED ✅');
process.exit(0);
