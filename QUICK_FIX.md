# Quick Fix for Your Vercel Deployment

## The Issue

Your dashboard at `https://noctis-guard.vercel.app` is working, but it can't connect to your bot because:

1. **Your bot is running locally** (localhost) - Vercel can't reach it
2. **BOT_NOTIFY_URL is not set** in Vercel environment variables

## Immediate Solutions

### Option A: Make Bot Work Without Connection (Quick Fix)

The dashboard will work for viewing servers and basic features, but plugin testing won't work until you connect the bot.

**What works without bot connection:**
- ✅ Login with Discord
- ✅ View your servers
- ✅ View server settings
- ✅ Change plugin states (on/off)
- ❌ Test plugins (needs bot)
- ❌ Live stats (needs bot)
- ❌ Giveaways (needs bot)

**No action needed** - the dashboard will show helpful error messages when bot features are used.

### Option B: Connect Your Bot (Full Features)

You need to deploy your bot to a public server. Here are the easiest options:

#### 1. Railway.app (Easiest - 5 minutes)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# In your bot directory
cd path/to/your/bot
railway init
railway up

# Get your URL
railway domain
# You'll get something like: https://your-bot.up.railway.app
```

Then in Vercel:
1. Go to your project settings
2. Environment Variables
3. Add:
   - `BOT_NOTIFY_URL` = `https://your-bot.up.railway.app/webhook`
   - `BOT_NOTIFY_SECRET` = `any_random_secret_key`

#### 2. Using Ngrok (Testing Only - 2 minutes)

```bash
# Install ngrok
npm install -g ngrok

# Run your bot locally
cd path/to/your/bot
npm start

# In another terminal
ngrok http 3000  # or whatever port your bot uses

# Copy the https URL (e.g., https://abc123.ngrok.io)
```

Then in Vercel:
1. Add `BOT_NOTIFY_URL` = `https://abc123.ngrok.io/webhook`
2. Add `BOT_NOTIFY_SECRET` = `any_random_secret_key`

**Note**: Ngrok URL changes every restart - only for testing!

## What You Need to Set in Vercel

Go to: https://vercel.com/your-username/noctis-guard/settings/environment-variables

### Required (Already Set?)
- `DISCORD_CLIENT_ID` - Your Discord app client ID
- `DISCORD_CLIENT_SECRET` - Your Discord app client secret

### For Bot Connection (Add These)
- `BOT_NOTIFY_URL` - Your bot's public URL + `/webhook`
- `BOT_NOTIFY_SECRET` - A secret key (make one up, use same in bot)

### Optional (For Better Features)
- `DISCORD_BOT_TOKEN` - Your bot token
- `DISCORD_BOT_ID` - Your bot's user ID

## After Setting Environment Variables

1. Go to Vercel dashboard
2. Click "Redeploy" (or push a commit to trigger redeploy)
3. Wait for deployment to finish
4. Test your dashboard

## Checking If It Works

### Test 1: Basic Dashboard
1. Go to `https://noctis-guard.vercel.app`
2. Click "Login with Discord"
3. You should see your servers
✅ If this works, the dashboard is deployed correctly

### Test 2: Bot Connection
1. Select a server
2. Try to test a plugin
3. If bot is connected, you'll see a success message
4. If not connected, you'll see "Bot webhook URL is not configured"

### Test 3: Check Logs
1. Go to Vercel dashboard
2. Click on your project
3. Go to "Deployments" → Latest deployment → "Functions"
4. Click on `/api/index.js`
5. View logs to see any errors

## Common Errors and Fixes

### "Not authenticated"
- **Fix**: Clear cookies and login again
- **Or**: Check `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are set

### "Failed to fetch guilds"
- **Fix**: Make sure you're logged in
- **Fix**: Check Discord OAuth redirect URI includes your Vercel URL

### "BOT_NOTIFY_URL not configured"
- **Fix**: Add `BOT_NOTIFY_URL` environment variable in Vercel
- **Fix**: Redeploy after adding

### "Bot server refused connection"
- **Fix**: Make sure bot is running
- **Fix**: Make sure bot URL is public (not localhost)
- **Fix**: Check bot has `/webhook` endpoint

## Your Bot Needs These Endpoints

Add to your bot code:

```javascript
// In your bot's main file
const express = require('express');
const app = express();
app.use(express.json());

// Stats endpoint
app.get('/stats', (req, res) => {
  res.json({
    guildCount: client.guilds.cache.size,
    totalMembers: client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
    commandsToday: 0,
    uptimeHours: Math.floor(process.uptime() / 3600)
  });
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
  // Verify secret
  if (req.headers['x-dashboard-secret'] !== process.env.DASHBOARD_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  console.log('Dashboard webhook:', req.body);
  // Handle webhook...
  
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000);
```

## Still Not Working?

1. **Check Vercel logs** - See what errors are happening
2. **Check bot logs** - See if bot is receiving requests
3. **Test bot URL directly** - Visit `https://your-bot-url/stats` in browser
4. **Verify secrets match** - `BOT_NOTIFY_SECRET` (Vercel) = `DASHBOARD_SECRET` (Bot)
5. **Check Discord Developer Portal** - Make sure OAuth redirect URI is correct

## Summary

**Minimum to get dashboard working:**
- ✅ `DISCORD_CLIENT_ID` in Vercel
- ✅ `DISCORD_CLIENT_SECRET` in Vercel
- ✅ OAuth redirect URI in Discord: `https://noctis-guard.vercel.app/callback`

**To get full features (bot connection):**
- ✅ Deploy bot to public server (Railway, Render, etc.)
- ✅ Add `BOT_NOTIFY_URL` in Vercel
- ✅ Add `BOT_NOTIFY_SECRET` in Vercel
- ✅ Add `DASHBOARD_SECRET` in bot (must match)
- ✅ Bot has `/webhook` and `/stats` endpoints

## Next Steps

1. Choose Option A (basic) or Option B (full features)
2. Set environment variables in Vercel
3. Redeploy
4. Test the dashboard
5. If issues, check logs and refer to BOT_CONNECTION_GUIDE.md