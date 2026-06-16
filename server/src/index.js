// ---------------------------------------------------------------------------
// Murder Lab — server entry point.
//
// Express serves the built client (if client/dist exists); Socket.io carries
// all real-time game traffic. All validation happens here / in game.js —
// clients are never trusted.
// ---------------------------------------------------------------------------

import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { Room, generateRoomCode } from './game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }, // local/LAN play; lock down for a real deployment
});

/** All active rooms, keyed by room code. */
const rooms = new Map();

// Serve the production client build when it exists, so `npm run build` +
// `npm start` gives a single-origin deployment on :3001.
// Also serve client/public directly, so assets dropped there (e.g. the
// lab-bg.jpg background photo) work immediately without rebuilding.
const publicPath = path.join(__dirname, '../../client/public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

const distPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(distPath)) {
  // index.html must never be cached, or browsers keep loading an old build
  // after an update. The hashed JS/CSS assets are safe to cache forever.
  const noCacheIndex = {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  };
  app.use(express.static(distPath, noCacheIndex));
  app.get('*', (_req, res) =>
    res.sendFile(path.join(distPath, 'index.html'), {
      headers: { 'Cache-Control': 'no-cache' },
    })
  );
} else {
  app.get('/', (_req, res) =>
    res.send('Murder Lab server is running. Start the client with `npm run dev:client`.')
  );
}

// Delete rooms that have been empty for 10+ minutes.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.emptySince && now - room.emptySince > 10 * 60 * 1000) {
      room.destroy();
      rooms.delete(code);
      console.log(`[room ${code}] cleaned up (empty)`);
    }
  }
}, 60 * 1000);

/** Resolve the room/player a socket belongs to (set during create/join/rejoin). */
function ctx(socket) {
  const room = rooms.get(socket.data.roomCode);
  const player = room?.getPlayer(socket.data.playerId);
  return { room, player };
}

/** Bind a socket to a player: join the channel and push current state. */
function attach(socket, room, player) {
  socket.data.roomCode = room.code;
  socket.data.playerId = player.id;
  socket.join(room.code);
  socket.emit('chat:history', room.chatLog);
  room.sync();
}

io.on('connection', (socket) => {
  // ---- Room creation / joining -------------------------------------

  socket.on('room:create', ({ name } = {}, ack) => {
    const code = generateRoomCode(rooms);
    const room = new Room(io, code);
    const result = room.addPlayer(name, socket.id);
    if (!result.ok) return ack?.(result);
    rooms.set(code, room);
    attach(socket, room, result.player);
    console.log(`[room ${code}] created by ${result.player.name}`);
    ack?.({ ok: true, code, playerId: result.player.id, token: result.player.token });
  });

  socket.on('room:join', ({ code, name } = {}, ack) => {
    const room = rooms.get(String(code || '').trim().toUpperCase());
    if (!room) return ack?.({ ok: false, error: 'Room not found. Check the code.' });
    const result = room.addPlayer(name, socket.id);
    if (!result.ok) return ack?.(result);
    attach(socket, room, result.player);
    room.systemChat(`${result.player.name} joined the room.`);
    ack?.({ ok: true, code: room.code, playerId: result.player.id, token: result.player.token });
  });

  socket.on('room:rejoin', ({ code, playerId, token } = {}, ack) => {
    const room = rooms.get(String(code || '').trim().toUpperCase());
    if (!room) return ack?.({ ok: false, error: 'Room no longer exists.' });
    const result = room.rejoin(playerId, token, socket.id);
    if (!result.ok) return ack?.(result);
    attach(socket, room, result.player);
    room.systemChat(`${result.player.name} reconnected.`);
    ack?.({ ok: true, code: room.code, playerId: result.player.id, token: result.player.token });
  });

  socket.on('room:leave', (_payload, ack) => {
    const { room, player } = ctx(socket);
    if (room && player) {
      socket.leave(room.code);
      room.systemChat(`${player.name} left the room.`);
      room.removePlayer(player.id);
    }
    socket.data.roomCode = null;
    socket.data.playerId = null;
    ack?.({ ok: true });
  });

  // ---- Game flow ----------------------------------------------------

  socket.on('game:start', ({ discussionSeconds, handSize } = {}, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.startRound(player.id, { discussionSeconds, handSize }));
  });

  socket.on('round:next', ({ discussionSeconds, handSize } = {}, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.startRound(player.id, { discussionSeconds, handSize }));
  });

  socket.on('killer:select', ({ meansCardId, clueCardId } = {}, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.killerSelect(player.id, meansCardId, clueCardId));
  });

  socket.on('forensic:mark', ({ tileId, optionId } = {}, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.forensicMark(player.id, tileId, optionId));
  });

  socket.on('forensic:swap', ({ replaceTileId } = {}, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.forensicSwap(player.id, replaceTileId));
  });

  socket.on('forensic:confirm', (_payload, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.forensicConfirm(player.id));
  });

  socket.on('discussion:end', (_payload, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.endDiscussion(player.id));
  });

  socket.on('timer:pauseToggle', (_payload, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.togglePause(player.id));
  });

  socket.on('player:solve', ({ suspectId, meansCardId, clueCardId } = {}, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.solve(player.id, suspectId, meansCardId, clueCardId));
  });

  socket.on('killer:guessWitness', ({ targetId } = {}, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.guessWitness(player.id, targetId));
  });

  socket.on('game:scoreboard', (_payload, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.showScoreboard(player.id));
  });

  // ---- Chat -----------------------------------------------------------

  socket.on('chat:send', ({ text } = {}, ack) => {
    const { room, player } = ctx(socket);
    if (!room || !player) return ack?.({ ok: false, error: 'Not in a room.' });
    ack?.(room.chat(player.id, text));
  });

  // ---- Disconnect ------------------------------------------------------

  socket.on('disconnect', () => {
    const { room, player } = ctx(socket);
    if (room && player && player.socketId === socket.id) {
      room.systemChat(`${player.name} disconnected.`);
      room.handleDisconnect(player.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Murder Lab server listening on http://localhost:${PORT}`);
});
