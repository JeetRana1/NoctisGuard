const fs = require('fs').promises;
const path = require('path');

module.exports = async (req, res) => {
  try{
    const f = path.join(process.cwd(), 'data', 'stats.json');
    const raw = await fs.readFile(f, 'utf8').catch(()=>null);
    if (!raw) return res.status(200).json({ guildCount: 0, totalMembers: 0, commandsToday: 0, uptimeHours: 0, lastUpdated: null });
    const obj = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.json(obj);
  }catch(e){ return res.status(500).json({ error: 'failed', message: String(e) }); }
};