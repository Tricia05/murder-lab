import { useGame } from '../context';

/**
 * The generated crime report — narrative prose built from the forensic
 * scientist's clue selections, arriving in three waves.
 */
export default function CrimeReport() {
  const { room } = useGame();
  if (!room.reports || room.reports.length === 0) return null;

  return (
    <section className="panel crime-report">
      <h3>📋 Crime Report — Case #{String(room.round).padStart(3, '0')}</h3>
      {room.reports.map((r) => (
        <div key={r.wave} className="report-block">
          <div className="report-title">{r.title}</div>
          <p className="report-text">{r.text}</p>
        </div>
      ))}
    </section>
  );
}
