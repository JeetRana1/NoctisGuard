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
      const BOT_PRESENCE_URL = process.env.BOT_PRESENCE_URL || null;
      const BOT_NOTIFY_SECRET = process.env.BOT_NOTIFY_SECRET || process.env.WEBHOOK_SECRET || '';

      if (Array.isArray(guilds) && guilds.length > 0){
        await Promise.all(guilds.map(async (g) => {
          try{
            // 1) Prefer direct bot token check if available
            if (BOT_TOKEN && BOT_ID){
              try{
                const memberResp = await axios.get(`https://discord.com/api/guilds/${g.id}/members/${BOT_ID}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
                g.bot_present = memberResp.status === 200;
                return;
              }catch(e){ /* fall through to next check */ }
            }

            // 2) Fallback to bot presence endpoint if configured
            if (BOT_PRESENCE_URL && BOT_ID){
              try{
                const base = BOT_PRESENCE_URL.replace(/\/$/, '');
                // prefer per-member check when available
                const r = await axios.get(`${base}/guild-member/${encodeURIComponent(g.id)}/${encodeURIComponent(BOT_ID)}`, { headers: (BOT_NOTIFY_SECRET ? { 'x-dashboard-secret': BOT_NOTIFY_SECRET } : {}), timeout: 5000, validateStatus: () => true });
                if (r && r.status >= 200 && r.status < 300 && r.data && r.data.member) {
                  g.bot_present = true;
                  return;
                }
                // if the member endpoint returns 404, treat as not present
                if (r && r.status === 404){ g.bot_present = false; return; }
              }catch(e){ /* ignore and mark as not present below */ }
            }

            // Default: not present
            g.bot_present = false;
          }catch(err){ console.warn('Error checking bot presence for guild', g.id, err?.message || err); g.bot_present = false; }
        }));
      }

      return res.json({ guilds });
    }catch(e){ const status = e.response?.status || 500; const data = e.response?.data || e.message; console.error('/api/guilds fetch failed', status, data); if (status === 401) return res.status(401).json({ error: 'Not authenticated' }); return res.status(500).json({ error: 'Failed to fetch guilds' }); }

  }catch(e){ console.error('guilds error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};