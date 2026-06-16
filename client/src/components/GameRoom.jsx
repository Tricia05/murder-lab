import { useState } from 'react';
import { useGame, PHASE_LABELS } from '../context';
import Timer from './Timer';
import PlayersGrid from './PlayersGrid';
import SceneBoard from './SceneBoard';
import CrimeReport from './CrimeReport';
import KillerPanel from './KillerPanel';
import Chat from './Chat';
import SolveModal from './SolveModal';
import WitnessGuessModal from './WitnessGuessModal';
import RevealOverlay from './RevealOverlay';
import Scoreboard from './Scoreboard';
import RoundHistory from './RoundHistory';

/** Private banner telling this player who they are this round. */
function RoleBanner() {
  const { room, me } = useGame();
  if (!me.role) return null;

  const cardOf = (playerId, deck, cardId) =>
    room.players.find((p) => p.id === playerId)?.hand[deck].find((c) => c.id === cardId);

  if (me.role === 'killer') {
    const pick = me.killerPick;
    return (
      <div className="role-banner role-killer">
        🔪 You are the <strong>MURDERER</strong>. Blend in, mislead, survive.
        {me.accompliceName && <span className="small"> Your accomplice: <strong>{me.accompliceName}</strong>.</span>}
        {pick && cardOf(me.playerId, 'means', pick.meansCardId) && (
          <span className="small">
            {' '}Your crime: {cardOf(me.playerId, 'means', pick.meansCardId).name} (means) +{' '}
            {cardOf(me.playerId, 'clue', pick.clueCardId).name} (evidence).
          </span>
        )}
      </div>
    );
  }

  if (me.role === 'forensic' || me.role === 'accomplice') {
    const info = me.killerInfo;
    const isForensic = me.role === 'forensic';
    return (
      <div className={`role-banner ${isForensic ? 'role-forensic' : 'role-killer'}`}>
        {isForensic ? (
          <>🥼 You are the <strong>FORENSIC SCIENTIST</strong>.</>
        ) : (
          <>🤝 You are the <strong>ACCOMPLICE</strong>. Protect the murderer — sow doubt, burn their attempts.</>
        )}
        {info?.killerName && (
          <span className="small">
            {' '}The murderer is <strong>{info.killerName}</strong>
            {info.meansCardId && cardOf(info.killerId, 'means', info.meansCardId) ? (
              <>
                {' '}— means: <strong>{cardOf(info.killerId, 'means', info.meansCardId).name}</strong>,
                evidence: <strong>{cardOf(info.killerId, 'clue', info.clueCardId).name}</strong>.
                {isForensic && ' Guide the investigators with markers only!'}
              </>
            ) : '.'}
          </span>
        )}
      </div>
    );
  }

  if (me.role === 'witness') {
    const info = me.witnessInfo;
    return (
      <div className="role-banner role-witness">
        👁 You are the <strong>WITNESS</strong>. You saw <strong>{info?.killerName}</strong> do it
        {info?.accompliceName && <> (helped by <strong>{info.accompliceName}</strong>)</>} — but not
        how. Steer the table <em>carefully</em>: if the murderer is caught, they get one guess at who you are.
      </div>
    );
  }

  return (
    <div className="role-banner role-investigator">
      🕵️ You are an <strong>INVESTIGATOR</strong>. Read the scene tiles and name the murderer, the means and the evidence.
    </div>
  );
}

/** Contextual instructions + action buttons for the current phase. */
function PhaseStatus({ onOpenSolve }) {
  const { room, me, act } = useGame();
  const self = room.players.find((p) => p.id === me.playerId);
  const isHost = !!self?.isHost;
  const canSolve = room.solvingOpen && me.role && me.role !== 'forensic' && self?.hasBadge;

  const solveBtn = canSolve && (
    <button className="btn btn-danger btn-small" onClick={onOpenSolve}>Solve the Crime</button>
  );

  switch (room.phase) {
    case 'dealing':
      return <div className="phase-status">🃏 Dealing cards and assigning secret roles…</div>;

    case 'killerSelect':
      return (
        <div className="phase-status">
          {me.role === 'killer'
            ? 'Choose your means of murder and key evidence below.'
            : '🌙 Night falls… the murderer is choosing the means and the evidence.'}
        </div>
      );

    case 'forensic':
      return (
        <div className="phase-status">
          {me.role === 'forensic'
            ? `🔬 Round ${room.round}/${room.totalRounds}: place your markers on the scene tiles.`
            : `🔬 The forensic scientist is examining the evidence (round ${room.round}/${room.totalRounds})…`}
          {solveBtn}
        </div>
      );

    case 'discussion':
      return (
        <div className="phase-status">
          🗣 Round {room.round}/{room.totalRounds} — discuss the evidence!
          {self?.role !== 'forensic' && !self?.hasBadge && <span className="small muted"> (your attempt is spent)</span>}
          {solveBtn}
          {isHost && (
            <>
              <button className="btn btn-small" onClick={() => act('timer:pauseToggle')}>
                {room.pausedRemaining != null ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button className="btn btn-small" onClick={() => act('discussion:end')}>
                {room.round < room.totalRounds ? 'Next round' : 'End game'}
              </button>
            </>
          )}
        </div>
      );

    default:
      return null;
  }
}

export default function GameRoom() {
  const { room, me, leave } = useGame();
  const [solving, setSolving] = useState(false);

  if (room.phase === 'scoreboard') return <Scoreboard />;

  const showSceneBoardPicker = room.phase === 'forensic' && me.role === 'forensic';
  const showSceneBoard = ['forensic', 'discussion', 'witnessGuess', 'reveal'].includes(room.phase);

  return (
    <div className="game">
      <header className="game-header">
        <div className="game-title">
          🔬 <strong>Murder Lab</strong>
          <span className="muted small"> · room {room.code}</span>
        </div>
        <div className="game-meta">
          <span className="phase-pill">{PHASE_LABELS[room.phase] || room.phase}</span>
          <Timer endsAt={room.timerEndsAt} pausedRemaining={room.pausedRemaining} />
          <button className="btn btn-ghost btn-small" onClick={leave}>Leave</button>
        </div>
      </header>

      <RoleBanner />
      <PhaseStatus onOpenSolve={() => setSolving(true)} />

      {room.phase === 'killerSelect' && me.role === 'killer' && <KillerPanel />}
      {showSceneBoard && <CrimeReport />}
      {showSceneBoard && <SceneBoard interactive={showSceneBoardPicker} />}

      <PlayersGrid />

      {room.solveAttempts.length > 0 && ['forensic', 'discussion'].includes(room.phase) && (
        <section className="panel">
          <h3>⚖️ Attempts</h3>
          <ul className="small accusation-list">
            {room.solveAttempts.map((a, i) => (
              <li key={i}>
                {a.byName} accused {a.suspectName}: {a.meansCard.name} + {a.clueCard.name} —{' '}
                {a.correct ? '✅' : '❌ wrong'}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Chat />
      <RoundHistory />

      {solving && <SolveModal onClose={() => setSolving(false)} />}
      {room.phase === 'witnessGuess' && <WitnessGuessModal />}
      {room.phase === 'reveal' && <RevealOverlay />}
    </div>
  );
}
