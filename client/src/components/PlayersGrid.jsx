import { useGame } from '../context';
import CardChip from './CardChip';

/**
 * Public board: every player with their two face-up hands (Means + Clue),
 * a badge indicator, and — at the reveal — the role chart and murder cards.
 */
export default function PlayersGrid() {
  const { room, me } = useGame();
  const reveal = room.reveal;

  return (
    <section className="panel">
      <h3>Suspects & Cards</h3>
      <div className="players-grid">
        {room.players.map((p) => {
          if (p.role === 'forensic' && !reveal) {
            // The scientist holds no cards — show a slim tile.
            return (
              <div key={p.id} className="player-tile tile-forensic">
                <div className="player-head">
                  <span className="player-name">
                    {p.isHost && '👑 '}{p.name}
                    {p.id === me.playerId && <span className="you-tag"> (you)</span>}
                  </span>
                  <span className="badge badge-forensic">🥼 Forensic Scientist</span>
                </div>
                <p className="muted small">Presents the evidence — holds no cards.</p>
              </div>
            );
          }
          const isKillerRevealed =
            (reveal && reveal.killerId === p.id) || (room.phase === 'witnessGuess' && p.role === 'killer');
          const isAccompliceRevealed = reveal && reveal.accompliceId === p.id;
          const isWitnessRevealed = reveal && reveal.witnessId === p.id;
          const markCard = (card) =>
            isKillerRevealed && reveal &&
            (card.id === reveal.meansCard?.id || card.id === reveal.clueCard?.id);
          const tagFor = (card) =>
            isKillerRevealed && reveal && card.id === reveal.meansCard?.id
              ? 'MEANS'
              : isKillerRevealed && reveal && card.id === reveal.clueCard?.id
              ? 'EVIDENCE'
              : null;

          return (
            <div
              key={p.id}
              className={['player-tile', p.connected ? '' : 'offline', isKillerRevealed ? 'tile-killer' : ''].join(' ')}
            >
              <div className="player-head">
                <span className="player-name">
                  {p.isHost && '👑 '}{p.name}
                  {p.id === me.playerId && <span className="you-tag"> (you)</span>}
                </span>
                <span className="player-badges">
                  {isKillerRevealed && <span className="badge badge-killer">🔪 Murderer</span>}
                  {isAccompliceRevealed && <span className="badge badge-killer">🤝 Accomplice</span>}
                  {isWitnessRevealed && <span className="badge badge-witness">👁 Witness</span>}
                  {p.role !== 'forensic' && (
                    <span className={`badge ${p.hasBadge ? 'badge-active' : 'badge-off'}`}>
                      {p.hasBadge ? '🎖️ badge' : '✘ spent'}
                    </span>
                  )}
                  {!p.connected && <span className="badge badge-off">offline</span>}
                </span>
              </div>
              <div className="deck-label means">Means</div>
              <div className="hand">
                {p.hand.means.map((card) => (
                  <CardChip key={card.id} card={card} selected={markCard(card)} tag={tagFor(card)} />
                ))}
              </div>
              <div className="deck-label clue">Clue</div>
              <div className="hand">
                {p.hand.clue.map((card) => (
                  <CardChip key={card.id} card={card} selected={markCard(card)} tag={tagFor(card)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
