import { useGame } from '../context';

/** Collapsible log of every finished round. */
export default function RoundHistory() {
  const { room } = useGame();
  if (room.history.length === 0) return null;

  return (
    <details className="panel history">
      <summary>
        <h3>📜 Round History ({room.history.length})</h3>
      </summary>
      {[...room.history].reverse().map((h) => (
        <div key={h.round} className="history-round">
          <div className="history-title">
            Round {h.round} —{' '}
            {h.winner === 'investigators' ? '🕵️ Investigators won' : '🔪 Killer won'}
          </div>
          <div className="small">
            Killer: <strong>{h.killerName}</strong> · Method: <strong>{h.methodCard}</strong> ·
            Evidence: <strong>{h.evidenceCard}</strong>
            {h.accompliceName && (
              <>
                {' '}
                · Accomplice: <strong>{h.accompliceName}</strong>
              </>
            )}
            {h.witnessName && (
              <>
                {' '}
                · Witness: <strong>{h.witnessName}</strong>
              </>
            )}
            {h.accuserName && (
              <>
                {' '}
                · Solved by <strong>{h.accuserName}</strong>
              </>
            )}
            {h.stealGuess && (
              <>
                {' '}
                · Killer's witness guess: <strong>{h.stealGuess.guessedName}</strong>{' '}
                {h.stealGuess.correct ? '✅ (win stolen!)' : '❌'}
              </>
            )}
          </div>
          <div className="small muted">
            Clues: {h.clues.map((c) => `${c.category}: ${c.option}`).join(' · ')}
          </div>
          {h.accusations.length > 0 && (
            <ul className="small history-accusations">
              {h.accusations.map((a, i) => (
                <li key={i}>
                  {a.by} accused {a.suspect} ({a.method} + {a.evidence}) {a.correct ? '✅' : '❌'}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </details>
  );
}
