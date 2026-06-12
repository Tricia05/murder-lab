import { useGame } from '../context';
import RoundHistory from './RoundHistory';

/** Between-rounds scoreboard; the host can launch the next round from here. */
export default function Scoreboard() {
  const { room, me, act, leave } = useGame();
  const isHost = room.players.find((p) => p.id === me.playerId)?.isHost;
  const ranked = [...room.players].sort((a, b) => b.score - a.score);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="lobby">
      <div className="panel">
        <h2>🏆 Scoreboard</h2>
        <table className="score-table">
          <thead>
            <tr>
              <th></th>
              <th>Player</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => (
              <tr key={p.id} className={p.id === me.playerId ? 'row-you' : ''}>
                <td>{medals[i] || i + 1}</td>
                <td>
                  {p.name}
                  {!p.connected && <span className="muted small"> (offline)</span>}
                </td>
                <td>{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted small center">
          Scoring — case solved: accuser +3, forensic +2, witness +2, investigators +1 · killer
          escapes: killer +5, accomplice +2 · witness unmasked: killer +4, accomplice +2
        </p>

        {isHost ? (
          <button className="btn btn-primary btn-block" onClick={() => act('round:next')}>
            Start New Round
          </button>
        ) : (
          <p className="muted center">Waiting for the host to start the next round…</p>
        )}

        <RoundHistory />
        <button className="btn btn-ghost btn-block" onClick={leave}>
          Leave game
        </button>
      </div>
    </div>
  );
}
