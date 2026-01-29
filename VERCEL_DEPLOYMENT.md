# Vercel Deployment Guide for NoctisGuard Dashboard

This guide explains how to deploy the NoctisGuard Discord bot dashboard to Vercel.

## Prerequisites

1. A Vercel account (free tier works)
2. Discord Application credentials (Client ID and Client Secret)
3. Your Discord bot token (optional, for enhanced features)

## Environment Variables

Configure these environment variables in your Vercel project settings:

### Required Variables

```env
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
```

### Optional Variables (for enhanced features)

```env
# Bot Token (enables guild member fetching and bot presence checking)
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_BOT_ID=your_bot_user_id

# Bot Webhook Integration (for real-time updates)
BOT_NOTIFY_URL=https://your-bot-server.com/webhook
BOT_NOTIFY_SECRET=your_shared_secret

# Bot Presence API (for member/presence data)
BOT_PRESENCE_URL=https://your-bot-server.com

# Webhook Secret (alternative to BOT_NOTIFY_SECRET)
WEBHOOK_SECRET=your_webhook_secret
```

## Deployment Steps

### 1. Connect Your Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub/GitLab repository
4. Vercel will auto-detect the configuration from `vercel.json`

### 2. Configure Environment Variables

1. In your Vercel project settings, go to "Environment Variables"
2. Add all required variables listed above
3. Make sure to add them for all environments (Production, Preview, Development)

### 3. Update Discord OAuth Redirect URI

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to OAuth2 → General
4. Add your Vercel deployment URL to "Redirects":
   ```
   https://your-app.vercel.app/callback
   ```

### 4. Deploy

1. Click "Deploy" in Vercel
2. Wait for the build to complete
3. Your dashboard will be live at `https://your-app.vercel.app`

## Important Notes

### File System Limitations

Vercel's serverless functions have a read-only file system except for `/tmp`. This deployment:

- Uses `/tmp/data` for ephemeral storage on Vercel
- Falls back to `./data` for local development
- Data in `/tmp` is cleared between cold starts
- For persistent data, configure `BOT_NOTIFY_URL` to sync with your bot

### Cold Starts

Serverless functions may experience cold starts (1-2 second delay) after periods of inactivity. This is normal for Vercel's free tier.

### Data Persistence

Since Vercel uses ephemeral storage:

1. **Recommended**: Configure `BOT_NOTIFY_URL` to fetch live data from your bot
2. **Alternative**: Accept that stats/activity data resets on cold starts
3. **For Production**: Consider using a database or external storage service

### API Routes

All API endpoints are handled through a single serverless function (`/api/index.js`) to stay within Vercel's free tier limits.

## Testing Your Deployment

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Click "Login with Discord"
3. Authorize the application
4. You should see your Discord servers listed

## Troubleshooting

### "Not authenticated" errors
- Check that `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are set correctly
- Verify the OAuth redirect URI matches your Vercel URL exactly

### "Failed to fetch guilds" errors
- Check browser console for CORS errors
- Verify your Discord token hasn't expired
- Try logging out and back in

### Bot presence not showing
- Ensure `DISCORD_BOT_TOKEN` and `DISCORD_BOT_ID` are set
- Verify the bot has proper permissions in your servers

### Stats not updating
- Configure `BOT_NOTIFY_URL` to point to your bot's webhook endpoint
- Ensure `BOT_NOTIFY_SECRET` matches on both dashboard and bot
- Check Vercel function logs for errors

## Local Development

To test locally before deploying:

```bash
npm install
npm start
```

The local server runs on `http://localhost:3000` and uses the `./data` directory for storage.

## Support

For issues specific to this deployment:
- Check Vercel function logs in your dashboard
- Review the browser console for client-side errors
- Ensure all environment variables are set correctly

For Discord API issues:
- Verify your application settings in Discord Developer Portal
- Check that your bot has the necessary permissions
- Review Discord API documentation