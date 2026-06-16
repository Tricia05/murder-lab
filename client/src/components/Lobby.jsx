import { useState } from 'react';
import { useGame } from '../context';

/** Pre-game lobby: share the room code, wait for players, host starts. */
export default function Lobby() {
  const { room, me, act, leave, notify } = useGame();
  const [minutes, setMinutes] = useState(2);
  const [handSize, setHandSize] = useState(4);

  const self = room.players.find((p) => p.id === me.playerId);
  const isHost = !!self?.isHost;
  const connectedCount = room.players.filter((p) => p.connected).length;
  const canStart = connectedCount >= room.minPlayers;

  function copyCode() {
    navigator.clipboard?.writeText(room.code).then(
      () => notify('Room code copied!'),
      () => {}
    );
  }

  return (
    <div className="lobby">
      <div className="panel">
        <h2>Lobby</h2>
        <p className="muted">Share this code with your friends:</p>
        <button className="room-code" onClick={copyCode} title="Copy code">
          {room.code} <span className="copy-hint">📋</span>
        </button>

        <h3>
          Players ({connectedCount}/{room.maxPlayers})
        </h3>
        <ul className="lobby-players">
          {room.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'offline'}>
              {p.isHost && '👑 '}
              {p.name}
              {p.id === me.playerId && <span className="you-tag"> (you)</span>}
              {!p.connected && ' — offline'}
            </li>
          ))}
        </ul>

        <p className="muted small center">
          🥼 The host plays the <strong>Forensic Scientist</strong> — everyone else might be
          the killer…
        </p>

        {isHost ? (
          <div className="host-controls">
            <label className="field">
              <span>Discussion time per round (3 rounds of evidence)</span>
              <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((m) => (
                  <option key={m} value={m}>
                    {m} minute{m === 1 ? '' : 's'} × 3 rounds
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Difficulty (cards in each hand)</span>
              <select value={handSize} onChange={(e) => setHandSize(Number(e.target.value))}>
                <option value={3}>Easy — 3 means + 3 clues</option>
                <option value={4}>Standard — 4 means + 4 clues</option>
                <option value={5}>Hard — 5 means + 5 clues</option>
              </select>
            </label>
            <button
              className="btn btn-primary btn-block"
              disabled={!canStart}
              onClick={() => act('game:start', { discussionSeconds: minutes * 60, handSize })}
            >
              {canStart
                ? 'Start Game'
                : `Waiting for players (${connectedCount}/${room.minPlayers} minimum)`}
            </button>
          </div>
        ) : (
          <p className="muted center">Waiting for the host to start the game…</p>
        )}

        <button className="btn btn-ghost btn-block" onClick={leave}>
          Leave room
        </button>
      </div>
    </div>
  );
}
