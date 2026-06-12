import { useState } from 'react';
import { useGame } from '../context';
import CardChip from './CardChip';

/**
 * Final accusation: pick a suspect, then the murder method and evidence
 * from that suspect's hand. One shot per investigator per round.
 */
export default function AccusationModal({ onClose }) {
  const { room, me, act } = useGame();
  const [suspectId, setSuspectId] = useState(null);
  const [methodId, setMethodId] = useState(null);
  const [evidenceId, setEvidenceId] = useState(null);

  // Valid suspects: in the round, not yourself, not the forensic scientist.
  const suspects = room.players.filter(
    (p) => p.hand.length > 0 && p.id !== me.playerId && p.role !== 'forensic'
  );
  const suspect = suspects.find((p) => p.id === suspectId);

  function pickSuspect(id) {
    setSuspectId(id);
    setMethodId(null);
    setEvidenceId(null);
  }

  function tapCard(card) {
    if (card.id === methodId) return setMethodId(null);
    if (card.id === evidenceId) return setEvidenceId(null);
    // The murder method must be a plausibly-lethal card.
    if (!methodId) {
      if (!card.methodOk) return;
      return setMethodId(card.id);
    }
    if (!evidenceId) return setEvidenceId(card.id);
  }

  async function confirm() {
    const res = await act('player:accuse', {
      suspectId,
      methodCardId: methodId,
      evidenceCardId: evidenceId,
    });
    if (res.ok) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>⚖️ Make Your Accusation</h3>
        <p className="small muted">
          You get exactly <strong>one</strong> accusation. To win, the suspect, the method
          <em> and</em> the evidence must all be correct.
        </p>

        <div className="modal-section">
          <div className="modal-step">1. Who is the killer?</div>
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
            <div className="modal-step">
              2. Pick the murder <strong>method</strong> (must be a lethal item, marked ⚔), then
              the <strong>evidence</strong>:
            </div>
            <div className="hand hand-large">
              {suspect.hand.map((card) => (
                <CardChip
                  key={card.id}
                  card={card}
                  onClick={() => tapCard(card)}
                  disabled={!methodId && !card.methodOk}
                  selected={card.id === methodId || card.id === evidenceId}
                  tag={
                    card.id === methodId
                      ? 'METHOD'
                      : card.id === evidenceId
                      ? 'EVIDENCE'
                      : card.methodOk && !methodId
                      ? '⚔'
                      : null
                  }
                />
              ))}
            </div>
          </div>
        )}

        <div className="row">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={!suspectId || !methodId || !evidenceId}
            onClick={confirm}
          >
            Accuse!
          </button>
        </div>
      </div>
    </div>
  );
}
