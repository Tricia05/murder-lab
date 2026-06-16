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

Murder Lab follows the rules of *Deception: Murder in Hong Kong*.

1. **Lobby** — the host creates a room and shares the 4-letter code. The host sets the
   discussion time (per round) and difficulty, then starts the game.
2. **Deal & roles** — every player gets two face-up hands: **4 Means cards** (blue —
   weapons/methods) and **4 Clue cards** (red — evidence). The **host is always the
   Forensic Scientist**. One other player is secretly the **Murderer**. With **6+ players**
   a **Accomplice** joins the murderer (knows the full solution) and a **Witness** is added
   (knows *who* did it, not *how*). Everyone else investigates.
3. **The crime** — the murderer secretly picks **1 Means card** (Means of Murder) and
   **1 Clue card** (Key Evidence) from their own hands.
4. **Forensic analysis** — the scientist can **never speak or type**. They communicate
   only by placing one bullet marker on each of **6 Scene tiles** (Cause of Death and
   Location of Crime are fixed; 4 are drawn at random, each with 6 options).
5. **Investigation — 3 rounds** — after round 1's markers, each later round the scientist
   **swaps one non-fixed tile** for a fresh one and re-marks it, so the evidence evolves.
   Players debate between rounds; a generated forensic report restates the markers.
6. **Solving the crime** — at any time, each investigator gets **one** attempt, which
   spends their badge: name a suspect + one of their Means cards + one of their Clue
   cards. To win it must match the suspect, the Means of Murder **and** the Key Evidence.
   A wrong guess just earns a silent "No."
   - 👁 If the case is solved and a **Witness** is in play, the caught murderer gets
     **one guess** at the witness's identity — correct = **the killer team steals the win**.
   - 🔪 The murderer wins if no one solves it by the end of round 3, or every badge is spent.
7. **Reveal & scoreboard** — full role chart, the murder cards, the steal attempt, points,
   then a fresh case.

**Difficulty** — hand size is configurable: 3 cards each (easier) · 4 (standard) · 5 (harder).

**Scoring:** case solved — solver **+3**, forensic **+2**, witness **+2**, other
investigators **+1** · murderer escapes — murderer **+5**, accomplice **+2** · witness
unmasked — murderer **+4**, accomplice **+2**.

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
