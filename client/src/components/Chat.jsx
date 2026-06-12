import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context';

const ROUND_ACTIVE = ['killerSelect', 'forensicClues', 'discussion', 'accusation', 'witnessGuess'];

/** Room chat. The forensic scientist is muted while a round is live. */
export default function Chat() {
  const { room, me, messages, act } = useGame();
  const [text, setText] = useState('');
  const listRef = useRef(null);

  const muted = me.role === 'forensic' && ROUND_ACTIVE.includes(room.phase);

  // Keep scrolled to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    const res = await act('chat:send', { text: trimmed });
    if (res.ok) setText('');
  }

  return (
    <section className="panel chat">
      <h3>💬 Discussion</h3>
      <div className="chat-list" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.system ? 'chat-system' : ''}`}>
            {!m.system && <span className="chat-author">{m.author}:</span>} {m.text}
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={muted ? 'You may only speak through the clue board 🤐' : 'Say something…'}
          disabled={muted}
        />
        <button className="btn" disabled={muted || !text.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
