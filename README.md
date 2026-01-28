# NoctisGuard

Web frontend for NoctisGuard.

## Quick start
- Open `index.html` in the browser to preview the static site.
- This project contains an optional Node server (`server.js`) and `package.json`.

## Deployment
- Quick fix (static-only site on Vercel — fixes "Cannot GET /"):
  - This repo now includes `vercel.json` which forces a static deployment and an SPA fallback (serves `index.html` at `/`). If you want just the frontend (no server endpoints), deploy to Vercel and the site root will work after deployment.
  - After deploying on Vercel, add environment variables in **Project Settings → Environment Variables**. You can import values from the provided `.env.vercel` as a guide (do not commit secrets publicly).
  - Note: Vercel serverless functions are stateless. To get the full dashboard experience (live stats, plugin config, presence), set `BOT_NOTIFY_URL` and `BOT_PRESENCE_URL` to your bot's public endpoints so the serverless API can proxy and forward updates to your bot.

- Full-featured option (recommended if you need OAuth / server APIs):
  - Host `server.js` on a Node-capable host (Render, Railway, Fly, Heroku, etc.) and set `BASE_URL` to that host (e.g., `https://your-dashboard.example.com`). This allows `/auth`, `/callback`, and the API endpoints to work.
  - Alternatively, convert `server.js` endpoints into Vercel Serverless Functions (advanced). Note: Vercel serverless functions are stateless and require different code patterns than a long-running Express server.

- Environment variables required when running the server (set in your host provider or `.env` for local dev):
  - `CLIENT_ID` and `CLIENT_SECRET` (or `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`) — Discord app credentials
  - `BASE_URL` — public URL where the dashboard is hosted (e.g., `https://noctis-guard.vercel.app`). If unset, the server will use `VERCEL_URL` when available or fallback to `http://localhost:3000` for local dev.
  - `BOT_NOTIFY_URL` — public URL the dashboard should call to notify the bot (e.g., `https://my-bot-host.com/webhook`). This must be reachable from the dashboard host.
  - `BOT_NOTIFY_SECRET` and `WEBHOOK_SECRET` — shared secrets for authenticating dashboard ↔ bot requests
  - Optional: `BOT_PRESENCE_URL`, `BOT_STATS_POLL_INTERVAL_MS`, `APP_NAME`, `APP_ICON_URL`, `LEVEL_BANNER_URL`.

- On Discord Developer Portal: add the following Redirect URIs to your OAuth application:
  - `https://noctis-guard.vercel.app/callback` (if dashboard handles OAuth) or
  - `https://<your-server-host>/callback` (if you host `server.js` somewhere else)
  - `https://noctis-guard.vercel.app/invite-callback` (optional for setup flow when using the dashboard domain)

- Local testing: install deps and run `npm run dev` to run `server.js` locally on port 3000. Keep `BASE_URL` set to `http://localhost:3000` (or leave unset). If you only want to preview the static site, opening `index.html` locally or deploying the repo to Vercel (static mode) will serve the frontend.

---


## Files of interest
- `index.html` — main site
- `server.js` — optional Node server
- `package.json` — project metadata

---

_Added by GitHub Copilot to help with initial repository setup._
