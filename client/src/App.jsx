import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import { GameContext } from './context';
import Home from './components/Home';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

// Session info so a refresh / dropped connection can silently rejoin the
// same seat. sessionStorage is per-tab, which keeps identities separate when
// several players share one browser (e.g. testing with multiple tabs);
// localStorage is the fallback for phones whose browser was fully closed.
const SESSION_KEY = 'murderlab-session';
const loadSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
};
const saveSession = (s) => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
};
const clearSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
};

export default function App() {
  const [room, setRoom] = useState(null); // public room state
  const [me, setMe] = useState(null);     // private state (role, secrets)
  const [messages, setMessages] = useState([]);
  const [toast, setToast] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const toastTimer = useRef(null);

  const notify = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  /** Send an event with an ack; surfaces server errors as a toast. */
  const act = useCallback(
    (event, payload = {}) =>
      new Promise((resolve) => {
        socket.emit(event, payload, (res) => {
          if (res && res.ok === false) notify(res.error || 'Something went wrong.');
          resolve(res || { ok: true });
        });
      }),
    [notify]
  );

  const resetLocal = useCallback(() => {
    setRoom(null);
    setMe(null);
    setMessages([]);
  }, []);

  const leave = useCallback(() => {
    socket.emit('room:leave', {}, () => {});
    clearSession();
    resetLocal();
  }, [resetLocal]);

  /** Called by Home after a successful create/join ack. */
  const onJoined = useCallback((res) => {
    saveSession({ code: res.code, playerId: res.playerId, token: res.token });
  }, []);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      // Try to resume a previous seat (page refresh, network blip).
      const session = loadSession();
      if (session) {
        socket.emit('room:rejoin', session, (res) => {
          if (!res?.ok) {
            clearSession();
            resetLocal();
          }
        });
      }
    }
    const onDisconnect = () => setConnected(false);
    const onRoomState = (state) => setRoom(state);
    const onYou = (priv) => setMe(priv);
    const onChat = (msg) => setMessages((m) => [...m.slice(-199), msg]);
    const onChatHistory = (log) => setMessages(log);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('you', onYou);
    socket.on('chat:message', onChat);
    socket.on('chat:history', onChatHistory);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('you', onYou);
      socket.off('chat:message', onChat);
      socket.off('chat:history', onChatHistory);
    };
  }, [resetLocal]);

  const inRoom = room && me;

  return (
    <GameContext.Provider value={{ room, me, messages, act, leave, notify }}>
      <div className="app">
        {!connected && <div className="banner banner-warn">Reconnecting to server…</div>}
        {toast && <div className="toast">{toast}</div>}

        {!inRoom ? (
          <Home onJoined={onJoined} act={act} />
        ) : room.phase === 'lobby' ? (
          <Lobby />
        ) : (
          <GameRoom />
        )}
      </div>
    </GameContext.Provider>
  );
}
