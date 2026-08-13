// Room logic shared by the Node dev server and the Cloudflare Worker.
// It knows nothing about sockets: it takes frames in, and returns the
// frames that should be sent out. That keeps both hosts honest about
// speaking the exact same protocol.

export const MAX_PLAYERS = 24;
export const MAX_NAME = 16;

const POS_MIN_INTERVAL = 80; // ms — anything faster is dropped
const TAP_MIN_INTERVAL = 60;

export function sanitizeName(raw) {
  const s = String(raw ?? '')
    .replace(/[^\p{L}\p{N} _.\-]/gu, '')
    .trim()
    .slice(0, MAX_NAME);
  return s || 'Slime';
}

function sanitizeColor(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(0xffffff, Math.floor(n))) : 0x53e6a5;
}

function num(v, fallback = 0, limit = 1e4) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-limit, Math.min(limit, n));
}

export class Room {
  constructor() {
    this.players = new Map(); // id -> record
    this.meta = new Map(); // id -> { lastPos, lastTap }
    this._nextId = 1;
  }

  get size() {
    return this.players.size;
  }

  isFull() {
    return this.players.size >= MAX_PLAYERS;
  }

  /** @returns {{id: string, welcome: object, broadcast: object|null}} */
  add(msg) {
    const id = String(this._nextId++);
    const p = {
      id,
      name: sanitizeName(msg?.name),
      color: sanitizeColor(msg?.color),
      x: num(msg?.x),
      z: num(msg?.z),
      f: num(msg?.f, 0, 10),
      s: num(msg?.s, 1, 10),
      zone: String(msg?.zone ?? 'puddle').slice(0, 24),
    };
    this.players.set(id, p);
    this.meta.set(id, { lastPos: 0, lastTap: 0 });
    return {
      id,
      welcome: { t: 'welcome', id, players: [...this.players.values()].filter((o) => o.id !== id) },
      broadcast: { t: 'join', p },
    };
  }

  remove(id) {
    if (!this.players.delete(id)) return null;
    this.meta.delete(id);
    return { t: 'leave', id };
  }

  /**
   * Handle a client frame.
   * @returns {{broadcast?: object, reply?: object}} frames to send
   */
  handle(id, msg, now = Date.now()) {
    const p = this.players.get(id);
    const m = this.meta.get(id);
    if (!p || !m) return {};

    switch (msg?.t) {
      case 'pos': {
        if (now - m.lastPos < POS_MIN_INTERVAL) return {};
        m.lastPos = now;
        p.x = num(msg.x);
        p.z = num(msg.z);
        p.f = num(msg.f, 0, 10);
        p.s = num(msg.s, 1, 10);
        p.zone = String(msg.zone ?? p.zone).slice(0, 24);
        return { broadcast: { t: 'pos', id, x: p.x, z: p.z, f: p.f, s: p.s, zone: p.zone } };
      }
      case 'tap': {
        if (now - m.lastTap < TAP_MIN_INTERVAL) return {};
        m.lastTap = now;
        return { broadcast: { t: 'tap', id } };
      }
      case 'name': {
        p.name = sanitizeName(msg.name);
        return { broadcast: { t: 'join', p } };
      }
      case 'ping':
        return { reply: { t: 'pong', t0: msg.t } };
      default:
        return {};
    }
  }
}
