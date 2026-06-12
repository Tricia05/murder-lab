import { io } from 'socket.io-client';

// In dev the client (5173) talks to the server on port 3001 of the same host,
// which also works for phones on the LAN. In a production build the server
// serves the client itself, so the origin is the server.
const URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? `http://${window.location.hostname}:3001` : window.location.origin);

export const socket = io(URL);
