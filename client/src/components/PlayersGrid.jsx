import { useGame } from '../context';
import CardChip from './CardChip';

const MARKER_PHASES = ['discussion', 'accusation'];

/**
 * Public board: every player and their 5 face-up cards, plus public
 * suspicion markers (🔍). During the reveal, the killer team lights up.
 */
export default function PlayersGrid() {
  const { room, me, act } = useGame();
  const reveal = room.reveal;

  const canMark =
    me.role && me.role !== 'forensic' && MARKER_PHASES.includes(room.phase);

  return (
    <section className="panel">
      <h3>Suspects & Cards</h3>
      {canMark && (
        <p className="small muted">
          🔍 Tap "mark" on a player to point public suspicion at them (you have 2 markers —
          everyone sees where they sit, and where they move).
        </p>
      )}
      <div className="players-grid">
        {room.players.map((p) => {
          const isKillerRevealed =
            (reveal && reveal.killerId === p.id) || (room.phase === 'witnessGuess' && p.role === 'killer');
          const isAccompliceRevealed = reveal && reveal.accompliceId === p.id;
          const isWitnessRevealed = reveal && reveal.witnessId === p.id;
          const markable = canMark && p.id !== me.playerId && p.role !== 'forensic' && p.hand.length > 0;
          const myName = room.players.find((q) => q.id === me.playerId)?.name;
          const markedByMe = p.markers.includes(myName);
          return (
            <div
              key={p.id}
              className={[
                'player-tile',
                p.connected ? '' : 'offline',
                isKillerRevealed ? 'tile-killer' : '',
              ].join(' ')}
            >
              <div className="player-head">
                <span className="player-name">
                  {p.isHost && '👑 '}
                  {p.name}
                  {p.id === me.playerId && <span className="you-tag"> (you)</span>}
                </span>
                <span className="player-badges">
                  {p.role === 'forensic' && <span className="badge badge-forensic">🥼 Forensic</span>}
                  {isKillerRevealed && <span className="badge badge-killer">🔪 Killer</span>}
                  {isAccompliceRevealed && <span className="badge badge-killer">🤝 Accomplice</span>}
                  {isWitnessRevealed && <span className="badge badge-witness">👁 Witness</span>}
                  {p.hasAccused && <span className="badge">✔ accused</span>}
                  {!p.connected && <span className="badge badge-off">offline</span>}
                </span>
              </div>
              <div className="hand">
                {p.hand.length === 0 ? (
                  <span className="muted small">no cards this round</span>
                ) : (
                  p.hand.map((card) => (
                    <CardChip
                      key={card.id}
                      card={card}
                      selected={
                        isKillerRevealed &&
                        reveal &&
                        (card.id === reveal.methodCard?.id || card.id === reveal.evidenceCard?.id)
                      }
                      tag={
                        isKillerRevealed && reveal && card.id === reveal.methodCard?.id
                          ? 'METHOD'
                          : isKillerRevealed && reveal && card.id === reveal.evidenceCard?.id
                          ? 'EVIDENCE'
                          : null
                      }
                    />
                  ))
                )}
              </div>
              {(p.markers.length > 0 || markable) && (
                <div className="markers-row">
                  {p.markers.map((name, i) => (
                    <span key={i} className="marker-chip" title={`Marked by ${name}`}>
                      🔍 {name}
                    </span>
                  ))}
                  {markable && (
                    <button
                      className={`btn btn-small marker-btn ${markedByMe ? 'btn-primary' : ''}`}
                      onClick={() => act('marker:toggle', { targetId: p.id })}
                    >
                      {markedByMe ? 'unmark' : 'mark'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
