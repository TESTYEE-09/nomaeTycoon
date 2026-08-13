// Multiplayer endpoint.
//
// Set VITE_MP_URL at build time (a .env file, or the GitHub Actions env) to
// point at your deployed relay, e.g.
//   VITE_MP_URL=wss://ooze-rush-mp.<your-subdomain>.workers.dev
//
// With nothing configured the game runs solo in production and looks for a
// local `node server/index.js` during development. A missing or unreachable
// relay is never fatal — it just means no other slimes.

const configured = import.meta.env.VITE_MP_URL;

export const MP_URL = configured || (import.meta.env.DEV ? 'ws://localhost:8787' : '');

export const MP_ROOM = import.meta.env.VITE_MP_ROOM || 'main';

/** ~10 position updates a second is plenty for slimes that interpolate. */
export const POS_SEND_INTERVAL = 0.1;
