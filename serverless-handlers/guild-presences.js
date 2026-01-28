const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

module.exports = async (req, res) => {
  try{
    const guildId = (req.url || '').split('/').pop() || null;
    if (!guildId) return res.status(400).json({ error: 'Missing guildId' });

    const presenceBase = process.env.BOT_PRESENCE_URL;
    const headers = {};
    if (process.env.BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = process.env.BOT_NOTIFY_SECRET;

    if (presenceBase){
      try{
        const url = `${presenceBase.replace(/\/$/, '')}/presences/${encodeURIComponent(guildId)}`;
        const r = await axios.get(url, { headers, timeout: 5000, validateStatus: () => true });
        if (r && r.status >= 200 && r.status < 300) return res.json(r.data);
      }catch(e){ console.warn('guild-presences: failed to proxy to bot', e?.message || e); }
    }

    // Fallback to stored presences
    try{
      const pf = path.join(process.cwd(), 'data', 'presences.json');
      const raw = await fs.readFile(pf, 'utf8').catch(()=>null);
      const all = raw ? JSON.parse(raw) : {};
      const pres = all[guildId] || [];
      return res.json({ guildId, presences: pres });
    }catch(e){ /* ignore */ }

    return res.status(404).json({ error: 'No presences available' });
  }catch(e){ console.error('guild-presences handler failed', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};