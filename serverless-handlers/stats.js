const axios = require('axios');
const { readJSON } = require('./storage-utils');

module.exports = async (req, res) => {
  try{
    // If a BOT_NOTIFY_URL is configured, prefer fetching live stats from the bot
    const BOT_URL = (process.env.BOT_NOTIFY_URL || '').replace(/\/$/, '');
    const headers = {};
    if (process.env.BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = process.env.BOT_NOTIFY_SECRET;
    if (BOT_URL){
      try{
        const r = await axios.get(BOT_URL + '/stats', { headers, timeout: 5000, validateStatus: () => true });
        if (r && r.status >= 200 && r.status < 300 && r.data){
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
          return res.json(r.data);
        }
      }catch(e){ /* fallback to file */ }
    }

    // Fallback to stored stats file (useful for local / ephemeral setups)
    const obj = await readJSON('stats.json', { guildCount: 0, totalMembers: 0, commandsToday: 0, uptimeHours: 0, lastUpdated: null });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.json(obj);
  }catch(e){ return res.status(500).json({ error: 'failed', message: String(e) }); }
};