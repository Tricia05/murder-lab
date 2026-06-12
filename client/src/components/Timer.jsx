import { useEffect, useState } from 'react';

function format(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Countdown driven by a server timestamp, so all clients agree.
 * When the host pauses the clock, the server sends the frozen remaining
 * seconds instead and the display stops ticking.
 */
export default function Timer({ endsAt, pausedRemaining }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [endsAt]);

  if (pausedRemaining != null) {
    return <span className="timer timer-paused">⏸ {format(pausedRemaining)}</span>;
  }
  if (!endsAt) return null;

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return (
    <span className={`timer ${remaining <= 30 ? 'timer-low' : ''}`}>
      ⏱ {format(remaining)}
    </span>
  );
}
