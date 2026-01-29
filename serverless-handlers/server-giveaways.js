const axios = require('axios');
const { readJSON } = require('./storage-utils');

module.exports = async (req, res) => {
  try{
    const guildId = req.query.guildId || (req.url && req.url.split('/').pop().split('?')[0]) || null;
    if (!guildId) return res.status(400).json({ error: 'Missing guildId' });

    // Try to ask bot for giveaways via BOT_NOTIFY_URL (type: giveaway_action list)
    const botUrl = process.env.BOT_NOTIFY_URL || null;
    const secret = process.env.BOT_NOTIFY_SECRET || process.env.WEBHOOK_SECRET || '';
    if (botUrl){
      try{
        const r = await axios.post(botUrl, { type: 'giveaway_action', guildId: guildId, action: 'list', payload: {} }, { headers: { 'x-dashboard-secret': secret, 'Content-Type': 'application/json' }, timeout: 5000, validateStatus: () => true });
        if (r && r.status >=200 && r.status < 300 && r.data && Array.isArray(r.data.giveaways)) return res.json({ ok: true, giveaways: r.data.giveaways });
      }catch(e){ console.warn('server-giveaways: bot call failed', e?.message || e); }
    }

    // Fallback: local data file
    try{
      const arr = await readJSON('giveaways.json', []);
      const g = (arr||[]).filter(x => String(x.guildId) === String(guildId));
      return res.json({ ok: true, giveaways: g });
    }catch(e){ console.warn('server-giveaways fallback failed', e); }

    return res.json({ ok: true, giveaways: [] });
  }catch(e){ console.error('server-giveaways error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};