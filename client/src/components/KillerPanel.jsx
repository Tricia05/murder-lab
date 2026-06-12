import { useState } from 'react';
import { useGame } from '../context';
import CardChip from './CardChip';

/**
 * Shown only to the killer during the killerSelect phase.
 * The METHOD must be a plausibly-lethal card; the EVIDENCE can be anything
 * else in the hand. First tap marks the method, second tap the evidence.
 */
export default function KillerPanel() {
  const { room, me, act, notify } = useGame();
  const [methodId, setMethodId] = useState(null);
  const [evidenceId, setEvidenceId] = useState(null);

  const self = room.players.find((p) => p.id === me.playerId);
  if (!self) return null;

  function tap(card) {
    if (card.id === methodId) return setMethodId(null);
    if (card.id === evidenceId) return setEvidenceId(null);
    if (!methodId) {
      if (!card.methodOk) {
        notify(`${card.name} couldn't kill anyone — the METHOD must be a lethal item.`);
        return;
      }
      return setMethodId(card.id);
    }
    if (!evidenceId) return setEvidenceId(card.id);
  }

  async function confirm() {
    await act('killer:select', { methodCardId: methodId, evidenceCardId: evidenceId });
  }

  return (
    <section className="panel panel-killer">
      <h3>🔪 Commit the Murder</h3>
      <p className="small">
        Choose two cards from <strong>your own hand</strong>: a <strong>lethal method</strong>{' '}
        (marked ⚔) and the <strong>key evidence</strong> you left behind. The forensic scientist
        — and your accomplice, if you have one — will see them. Ambiguous methods make for
        murkier clues…
      </p>
      <div className="hand hand-large">
        {self.hand.map((card) => (
          <CardChip
            key={card.id}
            card={card}
            onClick={() => tap(card)}
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
      {me.accompliceName && (
        <p className="small muted">🤝 Your accomplice is <strong>{me.accompliceName}</strong>.</p>
      )}
      <div className="row">
        <button className="btn btn-ghost" onClick={() => { setMethodId(null); setEvidenceId(null); }}>
          Clear
        </button>
        <button className="btn btn-danger" disabled={!methodId || !evidenceId} onClick={confirm}>
          Confirm Murder
        </button>
      </div>
    </section>
  );
}
