# Ooze Rush multiplayer protocol

Presence only: every client keeps its own economy in `localStorage`, and the
server relays *where players are and what they're doing*. Nothing
authoritative lives on the server, so a dropped connection costs a player
nothing but the other slimes on screen.

All frames are JSON. `id` is assigned by the server and never trusted from
the client.

## Client → server

| Frame | Fields | Notes |
| --- | --- | --- |
| `join` | `name`, `color`, `zone` | First frame after the socket opens. Name is trimmed to 16 chars and sanitized server-side. |
| `pos` | `x`, `z`, `f` (facing), `s` (scale), `zone` | Sent at most 10×/s, and only when something changed. |
| `tap` | — | Fires the tap ring on other screens. Rate-limited to 15/s. |
| `ping` | `t` | Server echoes it back as `pong`. |

## Server → client

| Frame | Fields |
| --- | --- |
| `welcome` | `id`, `players[]` — everyone already in the room |
| `join` | `p` — one player record |
| `pos` | `id`, `x`, `z`, `f`, `s`, `zone` |
| `tap` | `id` |
| `leave` | `id` |
| `pong` | `t` |

A player record is `{ id, name, color, x, z, f, s, zone }`.

Rooms are keyed by the `room` query parameter (default `main`) and are capped
at `MAX_PLAYERS`; an over-capacity socket is closed with code 4001.
