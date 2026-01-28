const axios = require('axios');

function parseCookies(cookieHeader){
  const out = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(';');
  for (const p of pairs){ const idx = p.indexOf('='); if (idx<0) continue; const k = p.slice(0,idx).trim(); const v = p.slice(idx+1).trim(); out[k]=v; }
  return out;
}

const BOT_ID = process.env.BOT_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_PRESENCE_TTL_MS = 5 * 60 * 1000;

// In-memory simple presence cache (per function instance)
const botPresenceCache = new Map();

module.exports = async (req, res) => {
  try{
    const cookies = parseCookies(req.headers && req.headers.cookie);
    const token = cookies && cookies.ng_token ? decodeURIComponent(cookies.ng_token) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    // fetch user guilds from Discord
    const maxRetries = 2;
    let attempt = 0;
    while (attempt <= maxRetries){
      attempt++;
      try{
        const gRes = await axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${token}` }, timeout: 10000, validateStatus: () => true });
        if (gRes.status !== 200) {
          // propagate 401/403 etc
          return res.status(gRes.status).json({ error: gRes.data || 'Failed to fetch guilds' });
        }
        const guilds = Array.isArray(gRes.data) ? gRes.data : [];

        // if BOT_TOKEN/BOT_ID present, check presence per guild
        if (BOT_TOKEN && BOT_ID && guilds.length > 0){
          for (const g of guilds){
            try{
              const cached = botPresenceCache.get(g.id);
              if (cached && cached.expiresAt > Date.now()){ g.bot_present = cached.present; continue; }
              const memberResp = await axios.get(`https://discord.com/api/guilds/${g.id}/members/${BOT_ID}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
              const present = memberResp.status === 200;
              botPresenceCache.set(g.id, { present, expiresAt: Date.now() + BOT_PRESENCE_TTL_MS });
              g.bot_present = present;
            }catch(e){ g.bot_present = false; }
          }
        }

        return res.json({ guilds });
      }catch(err){
        const status = err.response?.status;
        if (status === 429){ const retryAfter = Number(err.response?.data?.retry_after || err.response?.headers?.['retry-after'] || 1); await new Promise(r => setTimeout(r, Math.ceil(retryAfter*1000)+200)); continue; }
        console.error('Failed to fetch guilds', err.response?.data || err.message || err);
        return res.status(500).json({ error: 'Failed to fetch guilds' });
      }
    }
    return res.status(429).json({ error: 'Rate limited' });
  }catch(e){ console.error('api/guilds error', e); return res.status(500).json({ error: 'Internal error' }); }
};