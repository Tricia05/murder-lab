import { useState } from 'react';
import { useGame } from '../context';

const WAVE_NAMES = { 1: 'Wave 1 · Autopsy', 2: 'Wave 2 · Scene', 3: 'Wave 3 · Laboratory' };

/**
 * The forensic clue board — this round's 8 active categories, grouped by
 * report wave.
 *
 * Read-only for everyone — except the forensic scientist during the
 * forensicClues phase, when it becomes a picker (one option per category,
 * no free text, ever). For everyone else, categories belonging to a wave
 * that hasn't been published yet show as classified.
 */
export default function ClueBoard({ interactive }) {
  const { room, act } = useGame();
  const [draft, setDraft] = useState({});
  const categories = room.clueCategories;
  const published = room.clues || {};

  const allChosen = categories.every((c) => draft[c.id]);

  async function submit() {
    await act('forensic:submit', { selections: draft });
  }

  const waves = [1, 2, 3];

  return (
    <section className="panel clue-board">
      <h3>🧪 Clue Board</h3>
      {interactive && (
        <p className="small muted">
          Pick one finding per category — the full report publishes all at once. Point the clues{' '}
          <em>toward</em> the method without lighting it up.
        </p>
      )}
      {waves.map((w) => {
        const cats = categories.filter((c) => c.wave === w);
        if (cats.length === 0) return null;
        return (
          <div key={w} className="clue-wave">
            <div className="wave-label">{WAVE_NAMES[w]}</div>
            <div className="clue-grid">
              {cats.map((cat) => (
                <div key={cat.id} className="clue-category">
                  <div className="clue-label">{cat.label}</div>
                  <div className="clue-options">
                    {cat.options.map((opt) => {
                        const isPicked = interactive
                          ? draft[cat.id] === opt.id
                          : published[cat.id] === opt.id;
                        if (!interactive && !isPicked) {
                          return (
                            <span key={opt.id} className="clue-opt dim">
                              {opt.label}
                            </span>
                          );
                        }
                        return interactive ? (
                          <button
                            key={opt.id}
                            className={`clue-opt ${isPicked ? 'picked' : ''}`}
                            onClick={() => setDraft((d) => ({ ...d, [cat.id]: opt.id }))}
                          >
                            {opt.label}
                          </button>
                        ) : (
                          <span key={opt.id} className="clue-opt picked">
                            {opt.label}
                          </span>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {interactive && (
        <button className="btn btn-primary btn-block" disabled={!allChosen} onClick={submit}>
          {allChosen ? 'File the Forensic Report' : 'Pick one option in every category'}
        </button>
      )}
    </section>
  );
}
