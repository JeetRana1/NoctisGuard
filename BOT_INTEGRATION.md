# Bot Integration Guide 🔧

This guide shows how to integrate your bot with the dashboard plugin updates (webhook + reconciliation).

## Quick overview
- The dashboard POSTs plugin changes to `BOT_NOTIFY_URL` when a server updates plugin settings.
- Your bot should run a small HTTP endpoint (webhook) that verifies a shared secret and persists the state.
- On bot startup (or when needed), fetch state from the dashboard via `/api/server-plugins/:guildId` to reconcile missed updates.

## Environment
- Set these in your bot's `.env`:
  - `WEBHOOK_SECRET` — secret string the bot expects in `x-dashboard-secret` header on incoming webhook requests.
  - `BOT_WEBHOOK_PORT` — port for the webhook listener (default: `4000`).
  - `DASHBOARD_BASE` — URL of the dashboard server (default: `https://noctis-guard.vercel.app`).

- Set these in the dashboard `.env`:
  - `BOT_NOTIFY_URL` — the public URL the bot exposes for webhook POSTs (e.g. `https://<host>.ngrok.io/webhook`).
  - `BOT_NOTIFY_SECRET` — the same secret value as the bot's `WEBHOOK_SECRET` so the dashboard includes it in `x-dashboard-secret` when notifying.
  - `BOT_PRESENCE_URL` — (optional) the base URL of your bot server that exposes a presence endpoint (e.g. `https://noctis-guard.vercel.app`). If configured, the dashboard will query `/presences/:guildId` on that host to retrieve member presence (online/idle/dnd/offline) and show status dots in the Members list.

## Minimal example
Use `bot-webhook-example.js` (in this repo) as a copy-paste starter: it contains:
- `/webhook` POST route (verifies `x-dashboard-secret`) that accepts `{ type: 'plugin_update', guildId, state }`.
- Disk-backed persistence (`data/bot-guild-config.json`) and `guildConfig` in memory.
- `fetchPluginStateFromDashboard(guildId)` to query the dashboard for the latest state.
- `reconcileAllGuilds(client)` helper to call during bot startup.

## Applying plugin updates in the bot
- Keep per-guild configuration (e.g., `guildConfig[guildId].disabled` array).
- In your command/interaction handler, check whether the relevant plugin/category is disabled for the guild and early-return with a polite message.

Example check:
```js
if (guildConfig[guildId]?.disabled?.includes('moderation')){
  return interaction.reply({ content: 'Moderation commands are disabled on this server.', ephemeral: true });
}
```

## Security & reliability
- Verify `x-dashboard-secret` on every webhook call. Use HTTPS in production.
- Make the endpoint idempotent and persist updates to durable storage.
- On bot startup, fetch plugin states for joined guilds to ensure consistency.

## Troubleshooting
- If you don’t see updates applied: verify dashboard logs for POST attempts, check webhook secret header, and call `GET /api/server-plugins/:guildId` manually to inspect stored state.

---
If you want, I can also add a small README or an npm script to run the webhook listener in this repo. Would you like that? 📦