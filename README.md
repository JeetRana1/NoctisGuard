# NoctisGuard

Web frontend for NoctisGuard.

## Quick start
- Open `index.html` in the browser to preview the static site.
- This project contains an optional Node server (`server.js`) and `package.json`.

## Deployment
- Recommended quick option: Deploy the static site on Vercel by connecting this GitHub repository (Vercel will serve `index.html`). For OAuth and bot integration you must either:
  1. Deploy this full project as a Node app (using Render, Railway, Fly, Heroku, etc.) which runs `server.js` directly (recommended for full feature parity), or
  2. Convert the Express endpoints in `server.js` into Vercel Serverless Functions (advanced).

- Environment variables required when running the server (set in your host provider or `.env` for local dev):
  - `CLIENT_ID` and `CLIENT_SECRET` (or `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`) — Discord app credentials
  - `BASE_URL` (optional) — public URL where this app is hosted (e.g., `https://noctis-guard.vercel.app`). If unset, the server will use `VERCEL_URL` when available or fallback to `http://localhost:3000` for local dev.
  - `BOT_NOTIFY_URL` — public URL the dashboard should call to notify the bot (e.g., `https://my-bot-host.com/webhook`)
  - `BOT_NOTIFY_SECRET` and `WEBHOOK_SECRET` — shared secrets for authenticating dashboard ↔ bot requests
  - Other optional envs: `BOT_PRESENCE_URL`, `BOT_STATS_POLL_INTERVAL_MS`, etc.

- On Discord Developer Portal: add the following Redirect URIs to your OAuth application:
  - `https://noctis-guard.vercel.app/callback`
  - `https://noctis-guard.vercel.app/invite-callback` (optional for setup flow)

- Local testing: install deps and run `npm run dev` to run `server.js` locally on port 3000. Keep `BASE_URL` set to `http://localhost:3000` (or leave unset).


## Files of interest
- `index.html` — main site
- `server.js` — optional Node server
- `package.json` — project metadata

---

_Added by GitHub Copilot to help with initial repository setup._
