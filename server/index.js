// Node WebSocket server — used for local play (`npm run dev` in this folder)
// and for anyone who would rather self-host than deploy the Worker.
//
//   node server/index.js            # ws://localhost:8787
//   PORT=3000 node server/index.js
//
// Connect with ?room=<name> to get separate worlds.

import { WebSocketServer } from 'ws';
import { Room } from './room.js';

const PORT = Number(process.env.PORT || 8787);
const rooms = new Map();

function roomFor(name) {
  if (!rooms.has(name)) rooms.set(name, { room: new Room(), sockets: new Map() });
  return rooms.get(name);
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const roomName = (url.searchParams.get('room') || 'main').slice(0, 32);
  const entry = roomFor(roomName);
  let id = null;

  const send = (sock, frame) => {
    if (sock.readyState === sock.OPEN) sock.send(JSON.stringify(frame));
  };
  const broadcast = (frame, exceptId) => {
    for (const [pid, sock] of entry.sockets) if (pid !== exceptId) send(sock, frame);
  };

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString().slice(0, 2000));
    } catch {
      return;
    }

    if (id === null) {
      if (msg?.t !== 'join') return;
      if (entry.room.isFull()) {
        ws.close(4001, 'room full');
        return;
      }
      const { id: newId, welcome, broadcast: joinFrame } = entry.room.add(msg);
      id = newId;
      entry.sockets.set(id, ws);
      send(ws, welcome);
      broadcast(joinFrame, id);
      console.log(`[${roomName}] + ${id} (${entry.room.size} online)`);
      return;
    }

    const { broadcast: out, reply } = entry.room.handle(id, msg);
    if (out) broadcast(out, id);
    if (reply) send(ws, reply);
  });

  const drop = () => {
    if (id === null) return;
    entry.sockets.delete(id);
    const frame = entry.room.remove(id);
    if (frame) broadcast(frame);
    console.log(`[${roomName}] - ${id} (${entry.room.size} online)`);
    if (entry.room.size === 0) rooms.delete(roomName);
    id = null;
  };
  ws.on('close', drop);
  ws.on('error', drop);
});

console.log(`Ooze Rush multiplayer listening on ws://localhost:${PORT}`);
