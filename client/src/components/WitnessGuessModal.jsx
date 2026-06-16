import { useState } from 'react';
import { useGame } from '../context';

/**
 * The twist: the crime was solved, but the killer gets one final guess at
 * the witness's identity. Correct = the killer team steals the win.
 * Only the killer sees the picker; everyone else sees a tense waiting screen.
 */
export default function WitnessGuessModal() {
  const { room, me, act } = useGame();
  const [targetId, setTargetId] = useState(null);

  const isKiller = me.role === 'killer';

  // Candidates: anyone in the round except the forensic scientist, the
  // killer, and the killer's own accomplice.
  const candidates = room.players.filter(
    (p) =>
      p.hand.means.length > 0 &&
      p.id !== me.playerId &&
      p.role !== 'forensic' &&
      p.role !== 'killer' &&
      p.id !== me.accompliceId
  );

  async function confirm() {
    await act('killer:guessWitness', { targetId });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal reveal reveal-bad">
        <h2>👁 Someone Was Watching…</h2>
        {isKiller ? (
          <>
            <p>
              You've been caught — but you know there was a <strong>witness</strong>. Unmask them
              and your team escapes anyway. One guess.
            </p>
            <div className="suspect-list center-list">
              {candidates.map((p) => (
                <button
                  key={p.id}
                  className={`btn ${targetId === p.id ? 'btn-danger' : ''}`}
                  onClick={() => setTargetId(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <button className="btn btn-danger btn-block" disabled={!targetId} onClick={confirm}>
              Silence the Witness
            </button>
          </>
        ) : (
          <p>
            The case is solved… but the killer knows someone saw everything. If they identify the
            witness, the killer team steals the win. Hold your breath.
          </p>
        )}
      </div>
    </div>
  );
}
