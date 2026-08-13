// Cloudflare Worker + Durable Object build of the same relay.
// One Durable Object instance per room keeps every socket for that room in
// one place, which is the whole reason this fits in the free tier: no
// pub/sub, no Redis, just an object that owns its players.
//
//   npx wrangler deploy      (from this folder)

import { Room } from './room.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Ooze Rush relay. Connect a WebSocket to /?room=main', { status: 426 });
    }
    const roomName = (url.searchParams.get('room') || 'main').slice(0, 32);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(roomName));
    return stub.fetch(request);
  },
};

export class OozeRoom {
  constructor(state) {
    this.state = state;
    this.room = new Room();
    this.ids = new WeakMap(); // ws -> player id
    // Rebuild the id map after a hibernation wake-up.
    for (const ws of state.getWebSockets()) {
      const meta = ws.deserializeAttachment();
      if (meta?.id) this.ids.set(ws, meta.id);
    }
  }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  _send(ws, frame) {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      /* socket already gone */
    }
  }

  _broadcast(frame, exceptId) {
    for (const ws of this.state.getWebSockets()) {
      if (this.ids.get(ws) === exceptId) continue;
      this._send(ws, frame);
    }
  }

  webSocketMessage(ws, raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw).slice(0, 2000));
    } catch {
      return;
    }

    let id = this.ids.get(ws);
    if (!id) {
      if (msg?.t !== 'join') return;
      if (this.room.isFull()) {
        ws.close(4001, 'room full');
        return;
      }
      const { id: newId, welcome, broadcast } = this.room.add(msg);
      id = newId;
      this.ids.set(ws, id);
      ws.serializeAttachment({ id });
      this._send(ws, welcome);
      this._broadcast(broadcast, id);
      return;
    }

    const { broadcast, reply } = this.room.handle(id, msg);
    if (broadcast) this._broadcast(broadcast, id);
    if (reply) this._send(ws, reply);
  }

  webSocketClose(ws) {
    this._drop(ws);
  }

  webSocketError(ws) {
    this._drop(ws);
  }

  _drop(ws) {
    const id = this.ids.get(ws);
    if (!id) return;
    this.ids.delete(ws);
    const frame = this.room.remove(id);
    if (frame) this._broadcast(frame, id);
  }
}
