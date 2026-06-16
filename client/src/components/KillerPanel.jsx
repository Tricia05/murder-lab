import { useState } from 'react';
import { useGame } from '../context';
import CardChip from './CardChip';

/**
 * Shown only to the murderer during the killerSelect phase.
 * They pick one MEANS card (the Means of Murder) and one CLUE card (the Key
 * Evidence) from their own two hands.
 */
export default function KillerPanel() {
  const { room, me, act } = useGame();
  const [meansId, setMeansId] = useState(null);
  const [clueId, setClueId] = useState(null);

  const self = room.players.find((p) => p.id === me.playerId);
  if (!self) return null;

  async function confirm() {
    await act('killer:select', { meansCardId: meansId, clueCardId: clueId });
  }

  return (
    <section className="panel panel-killer">
      <h3>🔪 Commit the Murder</h3>
      <p className="small">
        Choose the <strong>Means of Murder</strong> (one blue card) and the{' '}
        <strong>Key Evidence</strong> (one red card) from your own cards. The forensic scientist
        — and your accomplice, if any — will know your choice. Pick a pairing the clues could be
        argued to fit someone else.
      </p>

      <div className="deck-label means">Means of Murder</div>
      <div className="hand hand-large">
        {self.hand.means.map((card) => (
          <CardChip
            key={card.id}
            card={card}
            onClick={() => setMeansId(card.id === meansId ? null : card.id)}
            selected={card.id === meansId}
            tag={card.id === meansId ? 'MEANS' : null}
          />
        ))}
      </div>

      <div className="deck-label clue">Key Evidence</div>
      <div className="hand hand-large">
        {self.hand.clue.map((card) => (
          <CardChip
            key={card.id}
            card={card}
            onClick={() => setClueId(card.id === clueId ? null : card.id)}
            selected={card.id === clueId}
            tag={card.id === clueId ? 'EVIDENCE' : null}
          />
        ))}
      </div>

      {me.accompliceName && (
        <p className="small muted">🤝 Your accomplice is <strong>{me.accompliceName}</strong>.</p>
      )}
      <div className="row">
        <button className="btn btn-ghost" onClick={() => { setMeansId(null); setClueId(null); }}>
          Clear
        </button>
        <button className="btn btn-danger" disabled={!meansId || !clueId} onClick={confirm}>
          Confirm Murder
        </button>
      </div>
    </section>
  );
}
