import { useGame } from '../context';
import CardChip from './CardChip';

const WINNER_TEXT = {
  investigators: '🎉 Case Solved!',
  killer: '🩸 The Killer Escapes!',
  killerSteal: '👁 The Witness Is Silenced!',
};

/** End-of-round reveal: winner, full role chart, and the two murder cards. */
export default function RevealOverlay() {
  const { room, me, act } = useGame();
  const reveal = room.reveal;
  if (!reveal) return null;

  const isHost = room.players.find((p) => p.id === me.playerId)?.isHost;
  const investigatorsWon = reveal.winner === 'investigators';

  return (
    <div className="modal-backdrop">
      <div className={`modal reveal ${investigatorsWon ? 'reveal-good' : 'reveal-bad'}`}>
        <h2>{WINNER_TEXT[reveal.winner]}</h2>
        {reveal.winner === 'killerSteal' && (
          <p>
            <strong>{reveal.accuserName}</strong> solved the case — but the killer unmasked the
            witness and the killer team escapes with the win.
          </p>
        )}
        {investigatorsWon && reveal.accuserName && (
          <p>
            <strong>{reveal.accuserName}</strong> cracked the case
            {reveal.stealGuess && !reveal.stealGuess.correct
              ? ` — and the killer guessed wrong (${reveal.stealGuess.guessedName} saw nothing).`
              : '!'}
          </p>
        )}
        <p>
          The killer was <strong>{reveal.killerName}</strong>.
        </p>
        <div className="reveal-cards">
          {reveal.methodCard && <CardChip card={reveal.methodCard} tag="METHOD" selected />}
          {reveal.evidenceCard && <CardChip card={reveal.evidenceCard} tag="EVIDENCE" selected />}
        </div>

        <div className="reveal-roles small">
          {reveal.accompliceName && (
            <span>🤝 Accomplice: <strong>{reveal.accompliceName}</strong></span>
          )}
          {reveal.witnessName && (
            <span>👁 Witness: <strong>{reveal.witnessName}</strong></span>
          )}
          <span>🥼 Forensic: <strong>{reveal.forensicName}</strong></span>
        </div>

        {room.accusations.length > 0 && (
          <div className="reveal-accusations">
            <h4>Accusations this round</h4>
            <ul>
              {room.accusations.map((a, i) => (
                <li key={i}>
                  {a.byName} → {a.suspectName} ({a.methodCard.name} + {a.evidenceCard.name}){' '}
                  {a.correct ? '✅' : '❌'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isHost ? (
          <button className="btn btn-primary btn-block" onClick={() => act('game:scoreboard')}>
            View Scoreboard
          </button>
        ) : (
          <p className="muted small center">Waiting for the host…</p>
        )}
      </div>
    </div>
  );
}
