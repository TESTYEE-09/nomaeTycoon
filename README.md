# Ooze Rush

A 3D browser tycoon/clicker built with Three.js + Vite. Play a slime that
taps Goo Blobs, builds an automated Goo empire, unlocks zones, and
rebirths into an ever-more-ridiculous ooze titan.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL.

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Move (camera-relative) |
| Drag | Look around (a short click stays a click) |
| Wheel / pinch | Zoom |
| `Q` `R` | Rotate camera |
| `Space` or click the blob | Tap for Goo |
| `E` | Buy the machine on the pad you're standing on |
| `1`–`4` | Toggle the Character / Tycoon / Zones / Rebirth panel |
| `T` | Quests drawer |
| `H` | Hide the interface |
| `?` | Controls reference |
| `Esc` | Close everything |

On touch: drag the left half of the screen for the virtual joystick, the
right half to look, pinch to zoom.

## UI principles

The canvas is the interface. Chrome lives in the corners as slim glass
pills, every panel is closed by default and toggles shut when you press
its tab again, and the sheet never exceeds ~38% of the screen height.

## Multiplayer

Other players show up as named slimes that walk, bounce, and flash a ring
when they tap. Presence only — every player's economy stays in their own
`localStorage`, so a dropped connection costs nothing and there is no way
for someone else's client to touch your Goo.

Play locally with two browser tabs:

```bash
npm run server   # ws://localhost:8787
npm run dev      # the client auto-connects in dev
```

For the deployed game you need a relay somewhere. The `server/` folder has
both hosts, speaking one shared protocol (`server/room.js`,
documented in `server/protocol.md`):

- **Cloudflare Worker + Durable Object** (free tier, one object per room):
  ```bash
  cd server && npx wrangler login && npx wrangler deploy
  ```
  Then set a GitHub Actions repo variable `MP_URL` to
  `wss://ooze-rush-mp.<your-subdomain>.workers.dev` and re-run the Pages
  workflow — `.github/workflows/deploy.yml` passes it in as `VITE_MP_URL`.
- **Any Node host** (Fly, Render, a VPS): `node server/index.js`, then point
  `MP_URL` at its `wss://` address.

With no `MP_URL` configured the deployed game simply runs solo: the online
chip hides and Settings says so. Rooms come from `?room=` on the socket URL
(`VITE_MP_ROOM`, default `main`) and cap at 24 players.

## Structure

- `src/config/balance.js` — every tunable economy number (costs, growth
  rates, machine output, zone prices, prestige formulas, quest pool).
- `src/core/` — `Game.js` (main loop/wiring), `Player.js`, `Input.js`,
  `CameraController.js`.
- `src/systems/` — `Economy.js`, `Tycoon.js`, `Zones.js`, `Quests.js`,
  `Prestige.js`, `Events.js` (lucky drops/golden rush), `Audio.js`
  (synthesized SFX), `Particles.js` (pooled bursts + floating text),
  `SaveManager.js` (localStorage autosave).
- `src/world/World.js` — procedurally builds the floating zone islands,
  gradient sky dome, stars, clouds, drifting motes, the goo lake, lantern
  bridges, zone gates, tycoon pads, the Goo Blob, and the vault.
- `src/world/RemotePlayer.js` — other players' slimes with canvas name tags.
- `src/systems/Multiplayer.js` — presence client (auto-reconnect, solo fallback).
- `server/` — the relay: shared `room.js`, a Node host, and a Cloudflare
  Worker + Durable Object host.
- `src/ui/UIManager.js` — all HTML/CSS overlay panels, toasts, tutorial,
  animated counters.

## Design notes

- Balance values are centralized in `balance.js` for easy tuning.
- Object pooling (`src/utils/pool.js`) is used for particles, floating
  text, and tycoon conveyor orbs to avoid per-frame GC.
- Decorative zone props use `THREE.InstancedMesh` for performance.
- Progress is autosaved to `localStorage` every 15s; Settings has a
  reset option.
