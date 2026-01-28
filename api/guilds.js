const axios = require('axios');

module.exports = async (req, res) => {
  try{
    const cookieHeader = req.headers.cookie || '';
    const cookies = {};
    cookieHeader.split(';').map(s=>s.trim()).forEach(p => { const idx = p.indexOf('='); if (idx > -1){ const k = p.slice(0,idx); const v = p.slice(idx+1); cookies[k] = v; }});
    const rawToken = cookies['ng_token'];
    if (!rawToken) return res.status(401).json({ error: 'Not authenticated' });
    const token = decodeURIComponent(rawToken);

    // Fetch guilds for user
    try{
      const guildsResp = await axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
      const guilds = Array.isArray(guildsResp.data) ? guildsResp.data : [];

      // Optionally check bot presence using BOT_TOKEN
      const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
      const BOT_ID = process.env.DISCORD_BOT_ID || process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
      if (BOT_TOKEN && BOT_ID){
        await Promise.all(guilds.map(async (g) => {
          try{
            const memberResp = await axios.get(`https://discord.com/api/guilds/${g.id}/members/${BOT_ID}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
            g.bot_present = memberResp.status === 200;
          }catch(e){ g.bot_present = false; }
        }));
      }

      return res.json({ guilds });
    }catch(e){ const status = e.response?.status || 500; const data = e.response?.data || e.message; console.error('/api/guilds fetch failed', status, data); if (status === 401) return res.status(401).json({ error: 'Not authenticated' }); return res.status(500).json({ error: 'Failed to fetch guilds' }); }

  }catch(e){ console.error('guilds error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};