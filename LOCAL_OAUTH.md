Local OAuth setup (real Discord OAuth)

1. Copy `.env.example` to `.env` and fill `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`.
2. Make sure `BASE_URL` matches where you'll run the server (default `https://noctis-guard.vercel.app`).
3. In the Discord Developer Portal, open your application -> OAuth2 -> Redirects and add:
   - `https://noctis-guard.vercel.app/callback`   - `https://noctis-guard.vercel.app/invite-callback` (optional, required if you want the "Setup" flow to return the user back to the per-server dashboard after inviting the bot)
4. Install dependencies and start the server:
   - `npm install`
   - `npm start`
5. Open `https://noctis-guard.vercel.app` and click *Login with Discord* — the site will redirect you through Discord and back to `/callback` which performs the token exchange.

Security notes:
- This example sets cookies with the access token for convenience in local testing only. Do NOT use this cookie approach in production.
- Keep your client secret private and do not commit it to source control. Use environment variables or a secrets manager for real deployments.

Optional: To enable server-side detection of whether your bot is already in a guild (so the dashboard shows **Manage** vs **Setup** correctly), add the following to your `.env`:

- `DISCORD_BOT_TOKEN` — a bot token for your bot (required to query guild membership).
- `DISCORD_BOT_ID` — optional bot user id (if omitted, `DISCORD_CLIENT_ID` will be used).
- `BOT_NOTIFY_URL` — (optional) a URL on your bot where the dashboard will POST changes when plugin state updates occur. Payload example:
  - POST body: { type: 'plugin_update', guildId: '<id>', state: { moderation: false, giveaway: true } }
- `BOT_NOTIFY_SECRET` — (optional) a shared secret the dashboard will send in header `x-dashboard-secret` when calling `BOT_NOTIFY_URL`. Set this to the same value as your bot's `WEBHOOK_SECRET` so the bot can verify incoming requests.

When configured, the server will check the bot's presence and add `bot_present` (true/false) to each guild object returned by `/api/guilds`. This is cached briefly to avoid rate limiting. The bot notify webhook is best-effort and failures do not block saving the plugin state.