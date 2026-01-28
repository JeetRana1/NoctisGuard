// bot-presence-endpoint-example.js
// Add this to your bot project (where your Discord client is available).
// Exposes a simple endpoint to return cached presences for a guild.
// Requires your bot to have GUILD_MEMBERS intent and member caching enabled.

// Usage:
//  - Add to your bot code, pass the 'client' (discord.js client) when starting server
//  - Protect the endpoint with the same WEBHOOK_SECRET used by the dashboard

require('dotenv').config();
const express = require('express');

const PORT = process.env.BOT_WEBHOOK_PORT || 4000; // reuse same port where webhook listens
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-me-to-a-secret';

function verifySecret(req, res, next){
  const h = req.header('x-dashboard-secret') || '';
  if (!WEBHOOK_SECRET || h !== WEBHOOK_SECRET) return res.status(403).json({ error: 'Forbidden' });
  next();
}

function startPresenceServer(client){
  const app = express();
  app.use(express.json());

  // Simple presence endpoint
  app.get('/presences/:guildId', verifySecret, async (req, res) => {
    const guildId = req.params.guildId;
    try{
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found or bot not in guild' });

      // Attempt to ensure we have some members cached; this is best-effort
      try{ await guild.members.fetch({ limit: 100 }); }catch(e){ /* ignore fetch errors */ }

      const presences = [];
      guild.members.cache.forEach(m => {
        presences.push({ id: m.id, status: (m.presence && m.presence.status) ? m.presence.status : 'offline' });
      });
      return res.json({ guildId, presences });
    }catch(e){ console.warn('Presence endpoint error', e); return res.status(500).json({ error: 'Failed to get presences' }); }
  });

  const server = app.listen(PORT, () => console.log(`Bot presence endpoint listening on ${PORT}`));
  return server;
}

module.exports = { startPresenceServer };
