const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

module.exports = async (req, res) => {
  try{
    // Try to proxy to bot /stats (if configured) to obtain authoritative history
    const BOT_URL = (process.env.BOT_NOTIFY_URL || '').replace(/\/$/, '');
    const headers = {};
    if (process.env.BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = process.env.BOT_NOTIFY_SECRET;
    if (BOT_URL){
      try{
        const r = await axios.get(BOT_URL + '/stats', { headers, timeout: 5000, validateStatus: () => true });
        if (r && r.status >= 200 && r.status < 300 && r.data){
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
          return res.json({ history: r.data.history || [] });
        }
      }catch(e){ /* fallback to file */ }
    }

    const f = path.join(process.cwd(), 'data', 'stats.json');
    const raw = await fs.readFile(f, 'utf8').catch(()=>null);
    if (!raw) return res.status(200).json({ history: [] });
    const obj = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.json({ history: obj.history || [] });
  }catch(e){ return res.status(500).json({ error: 'failed', message: String(e) }); }
};