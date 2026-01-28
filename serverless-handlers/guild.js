const axios = require('axios');

module.exports = async (req, res) => {
  try{
    const guildId = req.query.guildId || (req.url && req.url.split('/').pop()) || null;
    if (!guildId) return res.status(400).json({ error: 'Missing guildId' });

    // Try bot presence URL first
    const BOT_PRESENCE_URL = process.env.BOT_PRESENCE_URL || null;
    const BOT_NOTIFY_SECRET = process.env.BOT_NOTIFY_SECRET || process.env.WEBHOOK_SECRET || '';
    if (BOT_PRESENCE_URL){
      try{
        const r = await axios.get(`${BOT_PRESENCE_URL.replace(/\/$/, '')}/guilds/${encodeURIComponent(guildId)}`, { headers: (BOT_NOTIFY_SECRET ? { 'x-dashboard-secret': BOT_NOTIFY_SECRET } : {}), timeout: 5000, validateStatus: () => true });
        if (r && r.status >=200 && r.status < 300 && r.data) return res.json(r.data);
      }catch(e){ /* ignore */ }
    }

    // Fallback: try to call Discord API if we have BOT_TOKEN to get basic metadata
    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || null;
    if (BOT_TOKEN){
      try{
        const r = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
        if (r && r.status === 200) return res.json(r.data);
      }catch(e){ /* ignore */ }
    }

    return res.status(404).json({ error: 'Guild not found' });
  }catch(e){ console.error('guild.js error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};