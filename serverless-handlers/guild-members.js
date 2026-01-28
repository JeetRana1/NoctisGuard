const axios = require('axios');

module.exports = async (req, res) => {
  try{
    const guildId = req.query.guildId || (req.url && req.url.split('/').pop()) || null;
    if (!guildId) return res.status(400).json({ error: 'Missing guildId' });

    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || null;
    const BOT_PRESENCE_URL = process.env.BOT_PRESENCE_URL || null;
    const BOT_NOTIFY_SECRET = process.env.BOT_NOTIFY_SECRET || process.env.WEBHOOK_SECRET || '';

    // If bot token exists, call Discord API
    if (BOT_TOKEN){
      try{
        const limit = Math.min(200, Number(req.query.limit) || 25);
        const r = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members?limit=${limit}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 8000, validateStatus: () => true });
        if (r && r.status === 200){ const members = (r.data||[]).map(m => ({ id: m.user?.id, username: m.user?.username, discriminator: m.user?.discriminator, avatar: m.user?.avatar })); return res.json({ guildId, members }); }
      }catch(e){ /* ignore */ }
    }

    // Fallback to bot presence endpoint
    if (BOT_PRESENCE_URL){
      try{
        const limit = Math.min(200, Number(req.query.limit) || 25);
        const r = await axios.get(`${BOT_PRESENCE_URL.replace(/\/$/, '')}/guild-members/${encodeURIComponent(guildId)}?limit=${limit}`, { headers: (BOT_NOTIFY_SECRET ? { 'x-dashboard-secret': BOT_NOTIFY_SECRET } : {}), timeout: 8000, validateStatus: () => true });
        if (r && r.status >=200 && r.status < 300) return res.json(r.data);
      }catch(e){ /* ignore */ }
    }

    return res.status(404).json({ error: 'No members available' });
  }catch(e){ console.error('guild-members error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};