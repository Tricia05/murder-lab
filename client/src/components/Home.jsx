import { useRef, useState } from 'react';

// Remember the player's name between visits so it's prefilled next time.
const NAME_KEY = 'murderlab-name';

/* Small inline icons (SVG keeps them crisp and theme-colored everywhere). */
const PersonIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.2 0-8 2.1-8 5v2h16v-2c0-2.9-3.8-5-8-5z" />
  </svg>
);
const FingerprintIcon = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
    <path
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      d="M12 11.5a3 3 0 0 1 3 3V18 M12 11.5a3 3 0 0 0-3 3v1.2 M12 8A6.5 6.5 0 0 1 18.5 14.5v2 M12 8a6.5 6.5 0 0 0-6.5 6.5 M12 4.5A10 10 0 0 1 22 14.5 M12 4.5a10 10 0 0 0-10 10"
    />
  </svg>
);
const PeopleIcon = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
    <path fill="currentColor" d="M8 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm8 0a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM8 13c-3.2 0-6 1.6-6 4v2h12v-2c0-2.4-2.8-4-6-4zm8 0c-.6 0-1.1.1-1.7.2A5 5 0 0 1 16 17v2h6v-2c0-2.4-2.8-4-6-4z" />
  </svg>
);

/** Decorative divider: line · dot · (text) · dot · line */
function Divider({ children }) {
  return (
    <div className="fancy-divider">
      <span className="div-line" />
      <span className="div-dot" />
      {children && <span className="div-text">{children}</span>}
      <span className="div-dot" />
      <span className="div-line" />
    </div>
  );
}

const CODE_PLACEHOLDER = ['A', 'B', 'C', 'D'];

/** Landing screen: pick a name, then create or join a room. */
export default function Home({ onJoined, act }) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const codeInputRef = useRef(null);

  function changeName(value) {
    setName(value);
    localStorage.setItem(NAME_KEY, value);
  }

  function changeCode(value) {
    setCode(value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4));
  }

  async function create() {
    setBusy(true);
    const res = await act('room:create', { name });
    if (res.ok) onJoined(res);
    setBusy(false);
  }

  async function join(e) {
    e.preventDefault();
    setBusy(true);
    const res = await act('room:join', { name, code });
    if (res.ok) onJoined(res);
    setBusy(false);
  }

  return (
    <div className="home">
      <div className="home-card">
        <h1 className="logo">
          <span className="logo-icon">🔬</span> Murder <span>Lab</span>
        </h1>
        <p className="tagline">
          A social deduction game of forensic clues, bluffing and one perfect accusation.
          <span className="players-line">4–14 players.</span>
        </p>

        <Divider />

        <form onSubmit={join}>
          <label className="form-label" htmlFor="name-input">Your name</label>
          <div className="input-icon">
            <PersonIcon />
            <input
              id="name-input"
              value={name}
              onChange={(e) => changeName(e.target.value)}
              maxLength={20}
              placeholder="Detective Smith"
              autoFocus
            />
          </div>

          <button
            type="button"
            className="btn btn-create btn-block"
            disabled={busy || !name.trim()}
            onClick={create}
          >
            <FingerprintIcon /> Create Room
          </button>

          <Divider>or join a friend</Divider>

          <label className="form-label" htmlFor="code-input">Room code</label>
          {/* Four display boxes over an invisible input, so typing and mobile
              keyboards work normally while the code reads like evidence tags. */}
          <div className="code-boxes" onClick={() => codeInputRef.current?.focus()}>
            {CODE_PLACEHOLDER.map((ph, i) => (
              <span key={i} className={`code-box ${code[i] ? 'filled' : ''} ${i === code.length ? 'active' : ''}`}>
                {code[i] || ph}
              </span>
            ))}
            <input
              id="code-input"
              ref={codeInputRef}
              className="code-hidden"
              value={code}
              onChange={(e) => changeCode(e.target.value)}
              maxLength={4}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck="false"
            />
          </div>
          <button
            type="submit"
            className="btn btn-join btn-block"
            disabled={busy || !name.trim() || code.length !== 4}
          >
            <PeopleIcon /> Join Room
          </button>
        </form>
      </div>
    </div>
  );
}
