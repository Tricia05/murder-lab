# 🔬 Murder Lab

A real-time multiplayer social deduction game for **4–14 players**, inspired by
*Deception: Murder in Hong Kong*. One player secretly commits the perfect murder, the
forensic scientist knows the truth but can only communicate through a board of predefined
clues, and the investigators race the clock to crack the case.

**Tech:** React (Vite) · Node.js · Express · Socket.io · mobile-friendly UI

---

## Running locally

Requires **Node.js 18+**.

```bash
cd murder-lab

# 1. Install everything (root tooling + server + client)
npm run install:all

# 2. Start the server (port 3001) and the client (port 5173) together
npm run dev
```

Open **http://localhost:5173** — open multiple tabs (or incognito windows) to simulate
multiple players.

### Playing on phones (same Wi-Fi)

The Vite dev server is exposed on your LAN. Find your machine's IP
(`ipconfig` on Windows) and have phones open `http://<your-ip>:5173`.
The client automatically connects to the game server on port 3001 of the same host.

> Windows may prompt you to allow Node.js through the firewall the first time.

### Running the pieces separately

```bash
npm run dev:server   # Node server with auto-reload on :3001
npm run dev:client   # Vite dev server on :5173
```

### Production build (single origin)

```bash
npm run build        # builds client into client/dist
npm start            # server now serves the game at http://localhost:3001
```

---

## How to play

1. **Lobby** — the host creates a room and shares the 4-letter room code. Players join
   from any device. The host picks the discussion time and starts the game.
2. **Deal & roles** — every connected player gets **5 random item cards**, dealt fairly:
   every hand always contains at least two plausibly-lethal items, so *everyone* is a
   credible suspect. The **host is always the Forensic Scientist**. One other player is
   secretly the **Killer**. With 5+ players a **Witness** is added (knows *who* did it,
   not *how*); with 6+ players the killer also gets an **Accomplice** (knows the full
   solution, wins with the killer). Everyone else investigates. All hands are face-up.
3. **The murder** — the killer secretly picks a **lethal method** card and a **key
   evidence** card from their own hand. The accomplice sees the picks.
4. **Forensic analysis** — the scientist can **never type clues**. Each round, **8 clue
   categories** are active (4 core + 4 drawn from a 50-category library, with precision
   limits), and the scientist picks exactly one finding per category.
5. **Investigation** — the findings publish all at once as a generated **crime report**
   in three sections: *Autopsy · Scene · Laboratory*. Players debate the evidence and
   place public **suspicion markers** (🔍, two each) on the players they distrust.
6. **Accusations** — open as soon as the report lands. Each non-forensic player gets
   **one** accusation per round: suspect + lethal method + evidence from that suspect's
   hand.
   - ✅ A fully correct accusation solves the case…
   - 👁 …but if a Witness is in play, the caught killer gets **one final guess** at the
     witness's identity. Correct = **the killer team steals the win**.
   - 🔪 The killer wins outright if time runs out or every accusation misses.
7. **Reveal & scoreboard** — full role chart, murder cards, the steal attempt, points,
   then a fresh round with new cards, roles, and clue categories.

**Scoring:** case solved — accuser **+3**, forensic **+2**, witness **+2**, other
investigators **+1** · killer escapes — killer **+5**, accomplice **+2** · witness
unmasked — killer **+4**, accomplice **+2**.

---

## Project structure

```
murder-lab/
├── package.json          # root scripts (dev, build, start)
├── server/
│   └── src/
│       ├── index.js      # Express + Socket.io wiring, room registry
│       ├── game.js       # Room class: phases, timers, validation, scoring
│       ├── cards.js      # 72-card item pool
│       └── clues.js      # clue board categories & options
└── client/
    └── src/
        ├── App.jsx               # socket lifecycle, session/rejoin, toasts
        ├── socket.js             # socket.io-client connection
        ├── context.js            # shared game context + phase labels
        ├── styles.css            # dark "crime lab" theme, mobile-first
        └── components/
            ├── Home.jsx          # create / join screen
            ├── Lobby.jsx         # room code, player list, host settings
            ├── GameRoom.jsx      # per-phase orchestration
            ├── PlayersGrid.jsx   # all players + public 5-card hands
            ├── ClueBoard.jsx     # forensic clue picker / read-only board
            ├── KillerPanel.jsx   # killer's method+evidence selection
            ├── AccusationModal.jsx
            ├── RevealOverlay.jsx
            ├── Scoreboard.jsx
            ├── RoundHistory.jsx
            ├── Chat.jsx
            ├── Timer.jsx
            └── CardChip.jsx
```

## Design notes

- **Server-authoritative:** all rules (who may act, card ownership, clue validity,
  accusation correctness) are validated in `server/src/game.js`. Clients only receive
  sanitized views — investigators never receive the killer's identity over the wire.
- **Reconnect-friendly:** each player gets a secret token stored in `localStorage`; a
  page refresh or dropped mobile connection silently reclaims the same seat.
- **No soft-locks:** the killer and forensic phases auto-resolve with random picks if
  their timers expire, so an AFK player can't stall the room.
- **Timers are server timestamps** (`timerEndsAt`), so every device shows the same
  countdown regardless of when it connected.
