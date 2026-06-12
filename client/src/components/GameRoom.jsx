import { useState } from 'react';
import { useGame, PHASE_LABELS } from '../context';
import Timer from './Timer';
import PlayersGrid from './PlayersGrid';
import ClueBoard from './ClueBoard';
import CrimeReport from './CrimeReport';
import KillerPanel from './KillerPanel';
import Chat from './Chat';
import AccusationModal from './AccusationModal';
import WitnessGuessModal from './WitnessGuessModal';
import RevealOverlay from './RevealOverlay';
import Scoreboard from './Scoreboard';
import RoundHistory from './RoundHistory';

/** Private banner telling this player who they are this round. */
function RoleBanner() {
  const { room, me } = useGame();
  if (!me.role) return null;

  const nameOf = (id) => room.players.find((p) => p.id === id)?.name;
  const cardOf = (playerId, cardId) =>
    room.players.find((p) => p.id === playerId)?.hand.find((c) => c.id === cardId);

  if (me.role === 'killer') {
    const pick = me.killerPick;
    const card = (id) => cardOf(me.playerId, id);
    return (
      <div className="role-banner role-killer">
        🔪 You are the <strong>KILLER</strong>. Blend in, mislead, survive.
        {me.accompliceName && (
          <span className="small"> Your accomplice: <strong>{me.accompliceName}</strong>.</span>
        )}
        {pick && card(pick.methodCardId) && (
          <span className="small">
            {' '}
            Your crime: {card(pick.methodCardId).name} (method) + {card(pick.evidenceCardId).name}{' '}
            (evidence).
          </span>
        )}
      </div>
    );
  }

  if (me.role === 'forensic' || me.role === 'accomplice') {
    const info = me.killerInfo;
    const card = (id) => (info?.killerId ? cardOf(info.killerId, id) : null);
    const isForensic = me.role === 'forensic';
    return (
      <div className={`role-banner ${isForensic ? 'role-forensic' : 'role-killer'}`}>
        {isForensic ? (
          <>🥼 You are the <strong>FORENSIC SCIENTIST</strong>.</>
        ) : (
          <>🤝 You are the <strong>ACCOMPLICE</strong>. Protect the killer — sow doubt, burn their accusations.</>
        )}
        {info?.killerName && (
          <span className="small">
            {' '}
            The killer is <strong>{info.killerName}</strong>
            {info.methodCardId && card(info.methodCardId) ? (
              <>
                {' '}
                — method: <strong>{card(info.methodCardId).name}</strong>, evidence:{' '}
                <strong>{card(info.evidenceCardId).name}</strong>.
                {isForensic && ' Guide the investigators with clues only!'}
              </>
            ) : (
              '.'
            )}
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
        {info?.accompliceName && (
          <>
            {' '}
            (helped by <strong>{info.accompliceName}</strong>)
          </>
        )}
        — but not how. Steer the table <em>carefully</em>: if the killer is caught, they get one
        guess at who you are.
      </div>
    );
  }

  return (
    <div className="role-banner role-investigator">
      🕵️ You are an <strong>INVESTIGATOR</strong>. Study the reports and find the killer.
    </div>
  );
}

/** Contextual instructions + action buttons for the current phase. */
function PhaseStatus({ onOpenAccusation }) {
  const { room, me, act } = useGame();
  const self = room.players.find((p) => p.id === me.playerId);
  const isHost = !!self?.isHost;
  const canAccuse =
    room.accusationsOpen && me.role && me.role !== 'forensic' && !self?.hasAccused;

  switch (room.phase) {
    case 'dealing':
      return <div className="phase-status">🃏 Dealing cards and assigning secret roles…</div>;

    case 'killerSelect':
      return (
        <div className="phase-status">
          {me.role === 'killer'
            ? 'Choose your murder method and key evidence below.'
            : '🌙 Night falls… someone is committing the perfect murder.'}
        </div>
      );

    case 'forensicClues':
      return (
        <div className="phase-status">
          {me.role === 'forensic'
            ? 'Select one finding per category — these clues are your ONLY way to communicate.'
            : '🧪 The forensic scientist is examining the body…'}
        </div>
      );

    case 'discussion':
      return (
        <div className="phase-status">
          🗣 The full forensic report is in — discuss the evidence and inspect everyone's cards!
          {canAccuse && (
            <button className="btn btn-danger btn-small" onClick={onOpenAccusation}>
              Accuse
            </button>
          )}
          {isHost && (
            <>
              <button className="btn btn-small" onClick={() => act('timer:pauseToggle')}>
                {room.pausedRemaining != null ? '▶ Resume timer' : '⏸ Pause timer'}
              </button>
              <button className="btn btn-small" onClick={() => act('discussion:end')}>
                Skip to accusations
              </button>
            </>
          )}
        </div>
      );

    case 'accusation':
      return (
        <div className="phase-status">
          {me.role === 'forensic' ? (
            'The investigators are making their final accusations…'
          ) : self?.hasAccused ? (
            'You used your accusation. Hope it lands…'
          ) : me.role ? (
            <>
              ⚖️ Make your one and only accusation!
              <button className="btn btn-danger btn-small" onClick={onOpenAccusation}>
                Accuse
              </button>
            </>
          ) : (
            'Final accusations are underway…'
          )}
          {isHost && (
            <button className="btn btn-small" onClick={() => act('timer:pauseToggle')}>
              {room.pausedRemaining != null ? '▶ Resume timer' : '⏸ Pause timer'}
            </button>
          )}
        </div>
      );

    default:
      return null;
  }
}

export default function GameRoom() {
  const { room, me, leave } = useGame();
  const [accusing, setAccusing] = useState(false);

  // The scoreboard replaces the whole game view between rounds.
  if (room.phase === 'scoreboard') return <Scoreboard />;

  const showClueBoardPicker = room.phase === 'forensicClues' && me.role === 'forensic';
  const showClueBoard =
    showClueBoardPicker ||
    ['discussion', 'accusation', 'witnessGuess', 'reveal'].includes(room.phase);

  return (
    <div className="game">
      <header className="game-header">
        <div className="game-title">
          🔬 <strong>Murder Lab</strong>
          <span className="muted small"> · room {room.code} · round {room.round}</span>
        </div>
        <div className="game-meta">
          <span className="phase-pill">{PHASE_LABELS[room.phase] || room.phase}</span>
          <Timer endsAt={room.timerEndsAt} pausedRemaining={room.pausedRemaining} />
          <button className="btn btn-ghost btn-small" onClick={leave}>
            Leave
          </button>
        </div>
      </header>

      <RoleBanner />
      <PhaseStatus onOpenAccusation={() => setAccusing(true)} />

      {room.phase === 'killerSelect' && me.role === 'killer' && <KillerPanel />}
      <CrimeReport />
      {showClueBoard && <ClueBoard interactive={showClueBoardPicker} />}

      <PlayersGrid />

      {room.accusations.length > 0 && ['discussion', 'accusation'].includes(room.phase) && (
        <section className="panel">
          <h3>⚖️ Accusations</h3>
          <ul className="small accusation-list">
            {room.accusations.map((a, i) => (
              <li key={i}>
                {a.byName} accused {a.suspectName}: {a.methodCard.name} + {a.evidenceCard.name} —{' '}
                {a.correct ? '✅' : '❌ wrong'}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Chat />
      <RoundHistory />

      {accusing && <AccusationModal onClose={() => setAccusing(false)} />}
      {room.phase === 'witnessGuess' && <WitnessGuessModal />}
      {room.phase === 'reveal' && <RevealOverlay />}
    </div>
  );
}
