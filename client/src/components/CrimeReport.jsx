import { useGame } from '../context';

/**
 * A short narrative "forensic report" generated from the markers currently on
 * the scene tiles. Pure flavor — it only restates the public markers.
 */
export default function CrimeReport() {
  const { room } = useGame();
  if (!room.report || room.report.length === 0) return null;

  return (
    <section className="panel crime-report">
      <h3>📋 Forensic Report — Round {room.round}/{room.totalRounds}</h3>
      <div className="report-block">
        <p className="report-text">{room.report.join(' ')}</p>
      </div>
    </section>
  );
}
