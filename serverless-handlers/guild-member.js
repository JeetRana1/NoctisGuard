const axios = require('axios');

module.exports = async (req, res) => {
  try{
    const parts = req.url.split('/');
    const memberId = parts.pop() || null;
    const guildId = parts.pop() || null;
    if (!guildId || !memberId) return res.status(400).json({ error: 'Missing guildId or memberId' });

    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || null;
    const BOT_PRESENCE_URL = process.env.BOT_PRESENCE_URL || null;
    const BOT_NOTIFY_SECRET = process.env.BOT_NOTIFY_SECRET || process.env.WEBHOOK_SECRET || '';

    if (BOT_TOKEN){
      try{
        const r = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(memberId)}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
        if (r && r.status === 200){ const user = r.data && r.data.user ? r.data.user : {}; return res.json({ guildId, member: { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar } }); }
        if (r && r.status === 404) return res.status(404).json({ error: 'Member not found' });
      }catch(e){ /* ignore */ }
    }

    if (BOT_PRESENCE_URL){
      try{
        const url = `${BOT_PRESENCE_URL.replace(/\/$/, '')}/guild-member/${encodeURIComponent(guildId)}/${encodeURIComponent(memberId)}`;
        const r = await axios.get(url, { headers: (BOT_NOTIFY_SECRET ? { 'x-dashboard-secret': BOT_NOTIFY_SECRET } : {}), timeout: 5000, validateStatus: () => true });
        if (r && r.status >=200 && r.status < 300) return res.json(r.data);
        if (r && r.status === 404) return res.status(404).json({ error: 'Member not found' });
      }catch(e){ /* ignore */ }
    }

    return res.status(404).json({ error: 'Member not found' });
  }catch(e){ console.error('guild-member error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};