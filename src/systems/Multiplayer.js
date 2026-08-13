import { RemotePlayer } from '../world/RemotePlayer.js';
import { MP_URL, MP_ROOM, POS_SEND_INTERVAL } from '../config/net.js';

// Presence networking. Everything here is best-effort: the game is fully
// playable with the socket closed, so every failure path just means "solo".

const RECONNECT_BASE = 2; // seconds, doubles up to RECONNECT_MAX
const RECONNECT_MAX = 30;

export class Multiplayer {
  constructor(game) {
    this.game = game;
    this.peers = new Map(); // id -> RemotePlayer
    this.selfId = null;
    this.status = 'off'; // off | connecting | online | error
    this.ws = null;

    this._sendTimer = 0;
    this._retryIn = 0;
    this._retryDelay = RECONNECT_BASE;
    this._last = { x: null, z: null, f: null, s: null, zone: null };
    this._wantOn = game.save.data.settings.multiplayer !== false;

    if (this._wantOn) this.connect();
  }

  get playerName() {
    return this.game.save.data.playerName || 'Slime';
  }

  get count() {
    return this.status === 'online' ? this.peers.size + 1 : 0;
  }

  setEnabled(on) {
    this._wantOn = on;
    this.game.save.data.settings.multiplayer = on;
    if (on) this.connect();
    else this.disconnect();
  }

  connect() {
    if (!MP_URL) {
      this.status = 'off';
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    this.status = 'connecting';
    let ws;
    try {
      ws = new WebSocket(`${MP_URL}?room=${encodeURIComponent(MP_ROOM)}`);
    } catch (e) {
      this._onDrop();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this._retryDelay = RECONNECT_BASE;
      const p = this.game.player;
      ws.send(
        JSON.stringify({
          t: 'join',
          name: this.playerName,
          color: this.game.player.bodyMat.color.getHex(),
          x: p.position.x,
          z: p.position.z,
          f: p.facing,
          s: p.baseScale,
          zone: this.game.zones.currentZoneId,
        })
      );
    };
    ws.onmessage = (ev) => this._onFrame(ev.data);
    ws.onerror = () => {};
    ws.onclose = () => this._onDrop();
  }

  disconnect() {
    this.status = 'off';
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this._clearPeers();
  }

  _onDrop() {
    const wasOnline = this.status === 'online';
    this.ws = null;
    this._clearPeers();
    this.selfId = null;
    if (!this._wantOn || !MP_URL) {
      this.status = 'off';
      return;
    }
    this.status = 'error';
    this._retryIn = this._retryDelay;
    this._retryDelay = Math.min(RECONNECT_MAX, this._retryDelay * 2);
    if (wasOnline) this.game.ui.notify('Disconnected — playing solo', 'info');
  }

  _clearPeers() {
    for (const peer of this.peers.values()) peer.dispose();
    this.peers.clear();
  }

  _onFrame(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.t) {
      case 'welcome':
        this.selfId = msg.id;
        this.status = 'online';
        for (const p of msg.players) this._addPeer(p);
        this.game.ui.notify(
          msg.players.length ? `Online — ${msg.players.length + 1} slimes here` : 'Online — you have the world to yourself',
          'info'
        );
        break;
      case 'join': {
        const existing = this.peers.get(msg.p.id);
        if (existing) existing.setName(msg.p.name);
        else {
          this._addPeer(msg.p);
          this.game.ui.notify(`${msg.p.name} joined`, 'info', 'user');
        }
        break;
      }
      case 'pos': {
        const peer = this.peers.get(msg.id);
        if (peer) peer.applyPos(msg);
        break;
      }
      case 'tap': {
        const peer = this.peers.get(msg.id);
        if (peer) peer.tap();
        break;
      }
      case 'leave': {
        const peer = this.peers.get(msg.id);
        if (peer) {
          peer.dispose();
          this.peers.delete(msg.id);
        }
        break;
      }
    }
  }

  _addPeer(record) {
    if (record.id === this.selfId || this.peers.has(record.id)) return;
    this.peers.set(record.id, new RemotePlayer(this.game.scene, record));
  }

  _send(frame) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(frame));
  }

  sendTap() {
    this._send({ t: 'tap' });
  }

  sendName(name) {
    this._send({ t: 'name', name });
  }

  update(dt) {
    if (this._retryIn > 0) {
      this._retryIn -= dt;
      if (this._retryIn <= 0) this.connect();
    }

    for (const peer of this.peers.values()) peer.update(dt);

    if (this.status !== 'online') return;
    this._sendTimer += dt;
    if (this._sendTimer < POS_SEND_INTERVAL) return;
    this._sendTimer = 0;

    const p = this.game.player;
    const zone = this.game.zones.currentZoneId;
    const moved =
      Math.abs(p.position.x - this._last.x) > 0.01 ||
      Math.abs(p.position.z - this._last.z) > 0.01 ||
      Math.abs(p.facing - this._last.f) > 0.02 ||
      Math.abs(p.baseScale - this._last.s) > 0.01 ||
      zone !== this._last.zone;
    if (!moved) return;

    this._last = { x: p.position.x, z: p.position.z, f: p.facing, s: p.baseScale, zone };
    this._send({ t: 'pos', x: p.position.x, z: p.position.z, f: p.facing, s: p.baseScale, zone });
  }
}
