import { useGame } from '../context';

/**
 * The 6 scene tiles. The Forensic Scientist places one bullet marker on each
 * tile; everyone else reads the markers. Cause of Death and Location of Crime
 * are fixed; the other four can be swapped each round from round 2 on.
 *
 * `interactive` is true only for the scientist during the forensic phase.
 */
export default function SceneBoard({ interactive }) {
  const { room, act } = useGame();
  const { tiles, tileMarks, round, newTileId, swappedTileId } = room;

  // In rounds 2–3 the scientist must first swap a tile, then mark the new one.
  const swapPhase = interactive && round > 1;
  const swapDone = !!swappedTileId;

  const allMarked = tiles.every((t) => tileMarks[t.id]);
  const canConfirm = interactive && (round === 1 ? allMarked : swapDone && tileMarks[newTileId]);

  function markOption(tileId, optionId) {
    act('forensic:mark', { tileId, optionId });
  }
  function swap(tileId) {
    act('forensic:swap', { replaceTileId: tileId });
  }

  return (
    <section className="panel scene-board">
      <h3>🗂️ Scene Tiles</h3>
      {interactive && (
        <p className="small muted">
          {round === 1
            ? 'Place one marker on every tile — point the evidence toward the truth without giving it away.'
            : swapDone
            ? 'Now mark the new tile, then file the report.'
            : 'Choose ONE non-fixed tile to replace with fresh evidence, then mark it.'}
        </p>
      )}
      <div className="tiles-grid">
        {tiles.map((tile) => {
          const isNew = tile.id === newTileId;
          // What this tile lets the scientist do right now.
          const optionsClickable =
            interactive && (round === 1 || (swapPhase && isNew));
          const showSwap = swapPhase && !swapDone && !tile.fixed;
          return (
            <div key={tile.id} className={`scene-tile ${isNew ? 'tile-new' : ''} ${tile.fixed ? 'tile-fixed' : ''}`}>
              <div className="tile-head">
                <span className="tile-label">{tile.label}</span>
                {tile.fixed && <span className="tile-pin" title="Always in play">📌</span>}
                {showSwap && (
                  <button className="btn btn-small tile-swap" onClick={() => swap(tile.id)}>
                    swap
                  </button>
                )}
              </div>
              <div className="tile-options">
                {tile.options.map((opt) => {
                  const marked = tileMarks[tile.id] === opt.id;
                  if (optionsClickable) {
                    return (
                      <button
                        key={opt.id}
                        className={`tile-opt ${marked ? 'marked' : ''}`}
                        onClick={() => markOption(tile.id, opt.id)}
                      >
                        {opt.label}
                      </button>
                    );
                  }
                  return (
                    <span key={opt.id} className={`tile-opt ${marked ? 'marked' : 'dim'}`}>
                      {marked && <span className="bullet">🔴</span>}
                      {opt.label}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {interactive && (
        <button className="btn btn-primary btn-block" disabled={!canConfirm} onClick={() => act('forensic:confirm')}>
          {round === 1 ? 'File the Forensic Report' : 'File the Updated Report'}
        </button>
      )}
    </section>
  );
}
