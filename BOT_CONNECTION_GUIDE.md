# Connecting Your Discord Bot to the Vercel Dashboard

This guide explains how to connect your Discord bot (running separately) to your Vercel-deployed dashboard.

## The Problem

Your dashboard is deployed on Vercel at `https://noctis-guard.vercel.app`, but your bot is running separately (likely on your local machine or another server). For them to communicate, your bot needs to be:

1. **Publicly accessible** (not on localhost)
2. **Configured with webhook endpoints** that the dashboard can call

## Solution Options

### Option 1: Deploy Bot to a Cloud Platform (Recommended)

Deploy your bot to a platform that provides a public URL:

#### Railway.app (Recommended - Free Tier Available)
1. Go to [Railway.app](https://railway.app)
2. Create a new project from your bot's GitHub repository
3. Railway will give you a public URL like `https://your-bot.up.railway.app`
4. Set this as `BOT_NOTIFY_URL` in Vercel

#### Render.com (Free Tier Available)
1. Go to [Render.com](https://render.com)
2. Create a new Web Service
3. Connect your bot repository
4. You'll get a URL like `https://your-bot.onrender.com`

#### Heroku (Paid)
1. Deploy to Heroku
2. Get your app URL: `https://your-bot.herokuapp.com`

### Option 2: Use Ngrok for Testing (Temporary)

If you want to test with your local bot:

1. Install ngrok: `npm install -g ngrok`
2. Run your bot locally
3. In another terminal: `ngrok http 3000` (or whatever port your bot uses)
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Set this as `BOT_NOTIFY_URL` in Vercel (temporary - changes each time)

**Note**: Ngrok URLs change every time you restart, so this is only for testing.

## Required Bot Endpoints

Your bot needs to expose these HTTP endpoints:

### 1. Webhook Endpoint: `/webhook` (POST)
Receives notifications from the dashboard:

```javascript
app.post('/webhook', (req, res) => {
  const { type, guildId, pluginId, payload } = req.body;
  
  // Verify secret
  const secret = req.headers['x-dashboard-secret'];
  if (secret !== process.env.DASHBOARD_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Handle different event types
  switch(type) {
    case 'plugin_test':
      // Handle plugin test
      break;
    case 'plugin_update':
      // Handle plugin state change
      break;
    case 'plugin_config':
      // Handle plugin config update
      break;
    case 'giveaway_action':
      // Handle giveaway actions
      break;
  }
  
  res.json({ ok: true });
});
```

### 2. Stats Endpoint: `/stats` (GET)
Returns bot statistics:

```javascript
app.get('/stats', (req, res) => {
  res.json({
    guildCount: client.guilds.cache.size,
    totalMembers: client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
    commandsToday: commandCounter,
    uptimeHours: Math.floor(process.uptime() / 3600),
    lastUpdated: Date.now()
  });
});
```

### 3. Guild Member Endpoint: `/guild-member/:guildId/:memberId` (GET)
Returns member information:

```javascript
app.get('/guild-member/:guildId/:memberId', async (req, res) => {
  const { guildId, memberId } = req.params;
  try {
    const guild = client.guilds.cache.get(guildId);
    const member = await guild.members.fetch(memberId);
    res.json({
      member: {
        id: member.user.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar: member.user.avatar
      }
    });
  } catch(e) {
    res.status(404).json({ error: 'Member not found' });
  }
});
```

## Vercel Environment Variables

Once your bot is deployed, set these in Vercel:

```env
# Required
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret

# Bot Connection (IMPORTANT!)
BOT_NOTIFY_URL=https://your-bot-server.com/webhook
BOT_NOTIFY_SECRET=your_shared_secret_key

# Optional but recommended
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_BOT_ID=your_bot_user_id
BOT_PRESENCE_URL=https://your-bot-server.com
```

## Bot Environment Variables

Set these in your bot's environment:

```env
# Discord
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id

# Dashboard Connection
DASHBOARD_SECRET=your_shared_secret_key  # Must match BOT_NOTIFY_SECRET
DASHBOARD_URL=https://noctis-guard.vercel.app

# Server Port
PORT=3000
```

## Testing the Connection

### 1. Check Bot is Running
Visit: `https://your-bot-server.com/stats`
- Should return JSON with bot statistics

### 2. Test from Dashboard
1. Go to `https://noctis-guard.vercel.app`
2. Login with Discord
3. Select a server
4. Try to test a plugin (e.g., welcome message)
5. Check Vercel function logs for any errors

### 3. Check Vercel Logs
1. Go to Vercel Dashboard
2. Select your project
3. Click "Functions" tab
4. View logs for `/api/index.js`
5. Look for connection errors

## Common Issues

### "BOT_NOTIFY_URL not configured"
- Set `BOT_NOTIFY_URL` in Vercel environment variables
- Make sure it points to your bot's public URL

### "Bot server refused connection" (ECONNREFUSED)
- Bot is not running
- URL is incorrect
- Bot is running on localhost (not publicly accessible)

### "Bot server not found" (ENOTFOUND)
- Invalid URL in `BOT_NOTIFY_URL`
- DNS not resolving
- Typo in the URL

### "Connection to bot timed out"
- Bot is slow to respond
- Network issues
- Bot server is overloaded

### "Forbidden" (403)
- `BOT_NOTIFY_SECRET` doesn't match `DASHBOARD_SECRET`
- Secret is not set on one side

## Quick Start Checklist

- [ ] Deploy bot to a cloud platform (Railway, Render, etc.)
- [ ] Add webhook endpoint (`/webhook`) to bot
- [ ] Add stats endpoint (`/stats`) to bot
- [ ] Set `BOT_NOTIFY_URL` in Vercel to bot's public URL
- [ ] Set `BOT_NOTIFY_SECRET` in Vercel
- [ ] Set `DASHBOARD_SECRET` in bot (must match)
- [ ] Test connection by visiting bot's `/stats` endpoint
- [ ] Test from dashboard by trying a plugin test
- [ ] Check Vercel logs for any errors

## Example Bot Setup (Express.js)

```javascript
const express = require('express');
const app = express();
app.use(express.json());

const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET;

// Middleware to verify dashboard requests
function verifyDashboard(req, res, next) {
  const secret = req.headers['x-dashboard-secret'];
  if (secret !== DASHBOARD_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Stats endpoint
app.get('/stats', (req, res) => {
  res.json({
    guildCount: client.guilds.cache.size,
    totalMembers: client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
    commandsToday: 0,
    uptimeHours: Math.floor(process.uptime() / 3600),
    lastUpdated: Date.now()
  });
});

// Webhook endpoint
app.post('/webhook', verifyDashboard, (req, res) => {
  const { type, guildId, pluginId, payload } = req.body;
  console.log('Dashboard webhook:', type, guildId);
  
  // Handle the webhook
  // ... your logic here ...
  
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Bot HTTP server running');
});
```

## Need Help?

If you're still having issues:
1. Check Vercel function logs
2. Check your bot's console logs
3. Verify all environment variables are set correctly
4. Make sure your bot is publicly accessible
5. Test the bot's endpoints directly in your browser