import { useGame } from '../context';

/** Collapsible log of every finished round. */
export default function RoundHistory() {
  const { room } = useGame();
  if (room.history.length === 0) return null;

  return (
    <details className="panel history">
      <summary>
        <h3>📜 Case History ({room.history.length})</h3>
      </summary>
      {[...room.history].reverse().map((h, idx) => {
        const num = room.history.length - idx;
        return (
          <div key={num} className="history-round">
            <div className="history-title">
              Case {num} —{' '}
              {h.winner === 'investigators'
                ? '🕵️ Investigators won'
                : h.winner === 'killerSteal'
                ? '👁 Murderer stole the win'
                : '🔪 Murderer won'}
            </div>
            <div className="small">
              Murderer: <strong>{h.killerName}</strong> · Means: <strong>{h.meansCard}</strong> ·
              Evidence: <strong>{h.clueCard}</strong>
              {h.accompliceName && <> · Accomplice: <strong>{h.accompliceName}</strong></>}
              {h.witnessName && <> · Witness: <strong>{h.witnessName}</strong></>}
              {h.solverName && <> · Solved by <strong>{h.solverName}</strong></>}
              {h.stealGuess && (
                <> · Witness guess: <strong>{h.stealGuess.guessedName}</strong> {h.stealGuess.correct ? '✅' : '❌'}</>
              )}
            </div>
            <div className="small muted">
              Scene: {h.tiles.map((t) => `${t.label}: ${t.option}`).join(' · ')}
            </div>
            {h.attempts.length > 0 && (
              <ul className="small history-accusations">
                {h.attempts.map((a, i) => (
                  <li key={i}>
                    {a.by} → {a.suspect} ({a.means} + {a.clue}) {a.correct ? '✅' : '❌'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </details>
  );
}
