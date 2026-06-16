import { useState } from 'react';
import { useGame } from '../context';
import CardChip from './CardChip';

/**
 * "Solve the Crime" — a player's single attempt. Pick a suspect, then one of
 * that suspect's Means cards and one of their Clue cards. To win, all three
 * must match the murderer's actual choice. Wrong = the badge is gone for good.
 */
export default function SolveModal({ onClose }) {
  const { room, me, act } = useGame();
  const [suspectId, setSuspectId] = useState(null);
  const [meansId, setMeansId] = useState(null);
  const [clueId, setClueId] = useState(null);

  // Valid suspects: anyone in the round with cards, except you and the scientist.
  const suspects = room.players.filter(
    (p) => p.role !== 'forensic' && p.id !== me.playerId && p.hand.means.length > 0
  );
  const suspect = suspects.find((p) => p.id === suspectId);

  function pickSuspect(id) {
    setSuspectId(id);
    setMeansId(null);
    setClueId(null);
  }

  async function confirm() {
    const res = await act('player:solve', { suspectId, meansCardId: meansId, clueCardId: clueId });
    if (res.ok) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>⚖️ Solve the Crime</h3>
        <p className="small muted">
          You get <strong>one</strong> attempt — win or lose, your badge is spent. The suspect,
          the Means of Murder <em>and</em> the Key Evidence must all be correct.
        </p>

        <div className="modal-section">
          <div className="modal-step">1. Who is the murderer?</div>
          <div className="suspect-list">
            {suspects.map((p) => (
              <button
                key={p.id}
                className={`btn btn-small ${suspectId === p.id ? 'btn-primary' : ''}`}
                onClick={() => pickSuspect(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {suspect && (
          <div className="modal-section">
            <div className="modal-step">2. The Means of Murder (blue):</div>
            <div className="hand hand-large">
              {suspect.hand.means.map((card) => (
                <CardChip
                  key={card.id}
                  card={card}
                  onClick={() => setMeansId(card.id === meansId ? null : card.id)}
                  selected={card.id === meansId}
                  tag={card.id === meansId ? 'MEANS' : null}
                />
              ))}
            </div>
            <div className="modal-step">3. The Key Evidence (red):</div>
            <div className="hand hand-large">
              {suspect.hand.clue.map((card) => (
                <CardChip
                  key={card.id}
                  card={card}
                  onClick={() => setClueId(card.id === clueId ? null : card.id)}
                  selected={card.id === clueId}
                  tag={card.id === clueId ? 'EVIDENCE' : null}
                />
              ))}
            </div>
          </div>
        )}

        <div className="row">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!suspectId || !meansId || !clueId} onClick={confirm}>
            Solve!
          </button>
        </div>
      </div>
    </div>
  );
}
