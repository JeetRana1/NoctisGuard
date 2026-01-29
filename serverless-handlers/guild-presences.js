const axios = require('axios');
const { readJSON } = require('./storage-utils');

module.exports = async (req, res) => {
  try{
    const guildId = (req.url || '').split('/').pop().split('?')[0] || null;
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
      const all = await readJSON('presences.json', {});
      const pres = all[guildId] || [];
      return res.json({ guildId, presences: pres });
    }catch(e){ /* ignore */ }

    return res.status(404).json({ error: 'No presences available' });
  }catch(e){ console.error('guild-presences handler failed', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};