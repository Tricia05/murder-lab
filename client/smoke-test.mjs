// ---------------------------------------------------------------------------
// End-to-end smoke tests against a running server (http://localhost:3001).
//
//   node client/smoke-test.mjs
//
// Scenario A (4 players): core loop — waves, reports, gating, accusations,
//                         scoring, next round.
// Scenario B (6 players): accomplice + witness, suspicion markers, and the
//                         killer's witness-guess steal.
//
// Lives in client/ so it can resolve socket.io-client from client/node_modules.
// ---------------------------------------------------------------------------

import assert from 'node:assert';
import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';

const emit = (socket, event, payload = {}) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

function waitFor(pred, desc, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const iv = setInterval(() => {
      if (pred()) {
        clearInterval(iv);
        clearTimeout(to);
        resolve();
      }
    }, 100);
    const to = setTimeout(() => {
      clearInterval(iv);
      reject(new Error(`Timed out waiting for: ${desc}`));
    }, timeout);
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
const handOf = (ctx, playerCtx) =>
  ctx.state.players.find((pl) => pl.id === playerCtx.you.playerId).hand;

async function setupRoom(names, discussionSeconds) {
  const players = names.map(connect);
  const [host, ...rest] = players;
  await waitFor(() => players.every((p) => p.socket.connected), 'sockets connected');
  const created = await emit(host.socket, 'room:create', { name: host.name });
  assert(created.ok, 'room created');
  for (const p of rest) {
    const res = await emit(p.socket, 'room:join', { code: created.code, name: p.name });
    assert(res.ok, `${p.name} joined`);
  }
  await waitFor(() => host.state?.players.length === names.length, 'all in lobby');
  assert((await emit(host.socket, 'game:start', { discussionSeconds })).ok);
  await waitFor(() => players.every((p) => p.you?.role), 'roles assigned');
  await waitFor(() => host.state.phase === 'killerSelect', 'killerSelect phase');
  return { players, host, code: created.code };
}

async function killerCommits(killer) {
  const hand = handOf(killer, killer);
  const method = hand.find((c) => c.methodOk);
  const evidence = hand.find((c) => c.id !== method.id);
  // a non-lethal method must be rejected
  const nonLethal = hand.find((c) => !c.methodOk);
  if (nonLethal) {
    const bad = await emit(killer.socket, 'killer:select', {
      methodCardId: nonLethal.id,
      evidenceCardId: evidence.id === nonLethal.id ? method.id : evidence.id,
    });
    assert(bad.ok === false, 'non-lethal method rejected');
  }
  assert(
    (await emit(killer.socket, 'killer:select', { methodCardId: method.id, evidenceCardId: evidence.id })).ok
  );
  return { method, evidence };
}

async function forensicFiles(forensic) {
  const selections = {};
  for (const cat of forensic.state.clueCategories) selections[cat.id] = cat.options[0].id;
  const badClue = await emit(forensic.socket, 'forensic:submit', {
    selections: { ...selections, 'cause-of-death': 'i-typed-this-myself' },
  });
  assert(badClue.ok === false, 'invalid clue option rejected');
  assert((await emit(forensic.socket, 'forensic:submit', { selections })).ok);
}

// ===========================================================================
console.log('Scenario A — 4 players, core loop');
{
  const { players, host } = await setupRoom(['Alice', 'Bob', 'Cara', 'Dan'], 135);
  const killer = players.find((p) => p.you.role === 'killer');
  const forensic = players.find((p) => p.you.role === 'forensic');
  const invs = players.filter((p) => p.you.role === 'investigator');
  assert(forensic === host, 'host is the forensic scientist');
  assert(killer && invs.length === 2, '1 killer + 2 investigators');
  assert(host.state.players.every((pl) => pl.hand.length === 5), '5 public cards each');
  assert(
    host.state.players.every((pl) => pl.hand.filter((c) => c.methodOk).length >= 2),
    'every hand has ≥2 lethal cards (fair deal)'
  );
  ok('roles + fair deal verified');

  const inv = invs[0];
  assert(!inv.you.killerInfo && !inv.you.killerPick && !inv.you.witnessInfo, 'investigator knows nothing');
  assert(
    inv.state.players.every((pl) => pl.role === null || pl.role === 'forensic'),
    'killer hidden from public state'
  );
  ok('information secrecy verified');

  const { method, evidence } = await killerCommits(killer);
  await waitFor(() => host.state.phase === 'forensicClues', 'forensicClues phase');
  assert(forensic.you.killerInfo?.methodCardId === method.id, 'forensic sees the pick');
  assert(host.state.clueCategories.length === 8, '8 active clue categories drawn');
  ok(`killer chose ${method.name} + ${evidence.name}; 8 rotating categories active`);

  await forensicFiles(forensic);
  await waitFor(() => host.state.phase === 'discussion', 'discussion phase');
  assert(host.state.reports.length === 3, 'all three report sections published at once');
  assert(host.state.reports.every((r) => r.text.length > 10), 'reports have prose');
  assert(
    Object.keys(host.state.clues).length === host.state.clueCategories.length,
    'every clue published immediately'
  );
  assert(host.state.accusationsOpen, 'accusations open from the start of discussion');
  ok(`full crime report published at once: "${host.state.reports[0].text.slice(0, 60)}…"`);

  // Chat rules.
  assert((await emit(forensic.socket, 'chat:send', { text: 'psst' })).ok === false, 'forensic muted');
  assert((await emit(inv.socket, 'chat:send', { text: 'I have a theory…' })).ok);

  // Host can pause and resume the discussion timer.
  const notHost = await emit(inv.socket, 'timer:pauseToggle');
  assert(notHost.ok === false, 'only the host can pause');
  assert((await emit(host.socket, 'timer:pauseToggle')).ok, 'host paused');
  await waitFor(() => host.state.pausedRemaining != null, 'timer frozen');
  assert(host.state.timerEndsAt === null, 'no live deadline while paused');
  const frozenAt = host.state.pausedRemaining;
  assert(frozenAt > 0 && frozenAt <= 135, 'frozen remaining is sane');
  assert((await emit(host.socket, 'timer:pauseToggle')).ok, 'host resumed');
  await waitFor(() => host.state.timerEndsAt != null && host.state.pausedRemaining == null, 'timer running again');
  ok(`pause/resume works (froze at ${frozenAt}s, resumed)`);

  // Skip ahead, then accuse: one wrong, one right.
  assert((await emit(host.socket, 'discussion:end')).ok);
  await waitFor(() => host.state.phase === 'accusation', 'accusation phase');

  const suspect0 = inv.state.players.find((pl) => pl.id === invs[1].you.playerId);
  const m0 = suspect0.hand.find((c) => c.methodOk);
  const e0 = suspect0.hand.find((c) => c.id !== m0.id);
  const wrong = await emit(inv.socket, 'player:accuse', {
    suspectId: suspect0.id, methodCardId: m0.id, evidenceCardId: e0.id,
  });
  assert(wrong.ok, 'wrong accusation accepted');
  await waitFor(() => host.state.accusations.length === 1, 'accusation broadcast');
  assert(host.state.accusations[0].correct === false, 'marked wrong');
  const again = await emit(inv.socket, 'player:accuse', {
    suspectId: suspect0.id, methodCardId: m0.id, evidenceCardId: e0.id,
  });
  assert(again.ok === false, 'second accusation rejected');

  const right = await emit(invs[1].socket, 'player:accuse', {
    suspectId: killer.you.playerId, methodCardId: method.id, evidenceCardId: evidence.id,
  });
  assert(right.ok, 'correct accusation accepted');
  await waitFor(() => host.state.phase === 'reveal', 'reveal (no witness at 4p — no steal phase)');
  assert(host.state.reveal.winner === 'investigators', 'investigators win');

  const score = (ctx) => host.state.players.find((pl) => pl.id === ctx.you.playerId).score;
  assert.equal(score(invs[1]), 3, 'accuser +3');
  assert.equal(score(forensic), 2, 'forensic +2');
  assert.equal(score(invs[0]), 1, 'other investigator +1');
  assert.equal(score(killer), 0, 'killer 0');
  ok('case solved — scoring correct');

  assert((await emit(host.socket, 'game:scoreboard')).ok);
  await waitFor(() => host.state.phase === 'scoreboard', 'scoreboard');
  assert((await emit(host.socket, 'round:next')).ok);
  await waitFor(() => host.state.phase === 'dealing' && host.state.round === 2, 'round 2');
  assert.equal(host.state.history.length, 1, 'history recorded');
  ok('round 2 started, history recorded');

  players.forEach((p) => p.socket.disconnect());
}

// ===========================================================================
console.log('\nScenario B — 6 players: accomplice, witness, markers, the steal');
{
  const { players, host } = await setupRoom(['Holmes', 'Eve', 'Finn', 'Gina', 'Hugo', 'Ivy'], 135);
  const killer = players.find((p) => p.you.role === 'killer');
  const accomplice = players.find((p) => p.you.role === 'accomplice');
  const witness = players.find((p) => p.you.role === 'witness');
  const invs = players.filter((p) => p.you.role === 'investigator');
  assert(killer && accomplice && witness && invs.length === 2, 'roles: killer, accomplice, witness, 2 invs');
  assert(witness.you.witnessInfo.killerId === killer.you.playerId, 'witness knows the killer');
  assert(witness.you.witnessInfo.accompliceId === accomplice.you.playerId, 'witness knows the accomplice');
  ok('6-player roles dealt; witness knows WHO');

  const { method, evidence } = await killerCommits(killer);
  await waitFor(() => host.state.phase === 'forensicClues', 'forensicClues');
  assert(killer.you.accompliceId === accomplice.you.playerId, 'killer knows the accomplice');
  assert(accomplice.you.killerInfo?.methodCardId === method.id, 'accomplice sees the full solution');
  assert(!witness.you.killerInfo, 'witness does NOT see the cards');
  ok('knowledge web verified (accomplice=cards, witness=people only)');

  await forensicFiles(host);
  await waitFor(() => host.state.phase === 'discussion', 'discussion');

  // Suspicion markers.
  const inv = invs[0];
  const target = killer.you.playerId;
  assert((await emit(inv.socket, 'marker:toggle', { targetId: target })).ok, 'marker placed');
  await waitFor(
    () => host.state.players.find((pl) => pl.id === target).markers.length === 1,
    'marker visible publicly'
  );
  const selfMark = await emit(inv.socket, 'marker:toggle', { targetId: inv.you.playerId });
  assert(selfMark.ok === false, 'cannot mark yourself');
  ok('suspicion markers work and are public');

  // Solve the case → the steal phase must trigger.
  assert((await emit(host.socket, 'discussion:end')).ok);
  await waitFor(() => host.state.phase === 'accusation', 'accusation phase');
  const right = await emit(invs[1].socket, 'player:accuse', {
    suspectId: killer.you.playerId, methodCardId: method.id, evidenceCardId: evidence.id,
  });
  assert(right.ok, 'correct accusation accepted');
  await waitFor(() => host.state.phase === 'witnessGuess', 'witnessGuess phase triggered');
  assert(
    host.state.players.find((pl) => pl.id === killer.you.playerId).role === 'killer',
    'killer publicly exposed during the final guess'
  );
  ok('case solved → killer gets the final witness guess');

  // Only the killer may guess; accomplice may not be guessed.
  const notKiller = await emit(inv.socket, 'killer:guessWitness', { targetId: witness.you.playerId });
  assert(notKiller.ok === false, 'non-killer cannot guess');
  const badTarget = await emit(killer.socket, 'killer:guessWitness', { targetId: accomplice.you.playerId });
  assert(badTarget.ok === false, 'accomplice is not a valid guess target');

  // Killer nails the witness → the steal.
  assert((await emit(killer.socket, 'killer:guessWitness', { targetId: witness.you.playerId })).ok);
  await waitFor(() => host.state.phase === 'reveal', 'reveal');
  assert(host.state.reveal.winner === 'killerSteal', 'killer team steals the win');
  assert(host.state.reveal.stealGuess.correct === true, 'steal recorded');

  const score = (ctx) => host.state.players.find((pl) => pl.id === ctx.you.playerId).score;
  assert.equal(score(killer), 4, 'killer +4 (steal)');
  assert.equal(score(accomplice), 2, 'accomplice +2');
  assert.equal(score(invs[1]), 0, 'accuser gets nothing — win stolen');
  ok('steal scoring correct (killer +4, accomplice +2)');

  players.forEach((p) => p.socket.disconnect());
}

console.log('\nALL SMOKE TESTS PASSED ✅');
process.exit(0);
