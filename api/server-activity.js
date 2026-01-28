const fs = require('fs').promises;
const path = require('path');

module.exports = async (req, res) => {
  try{
    const guildId = req.query && req.query.guildId ? req.query.guildId : (req.url && req.url.split('/').pop()) || null;
    // try to read data/activity.json
    const f = path.join(process.cwd(), 'data', 'activity.json');
    const raw = await fs.readFile(f, 'utf8').catch(()=>null);
    const arr = raw ? JSON.parse(raw) : [];
    const items = guildId ? arr.filter(x => x.guildId === String(guildId)).slice(0,40) : [];
    return res.json({ guildId, activity: items });
  }catch(e){ console.error('server-activity error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};