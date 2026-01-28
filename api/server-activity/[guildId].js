const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const guildId = req.query && (req.query.guildId || req.query.id) || req.query?.guildId || '';
    const limit = Number(req.query && req.query.limit) || 100;
    const p = path.join(process.cwd(), 'data', 'activity.json');
    const raw = fs.readFileSync(p, 'utf8') || '[]';
    const arr = JSON.parse(raw || '[]');
    const filtered = arr.filter(a => String(a.guildId) === String(guildId)).slice(-limit).reverse();
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ guildId, activity: filtered });
  } catch (err) {
    console.warn('api/server-activity error', err && err.message);
    return res.status(500).json({ guildId: req.query && req.query.guildId || '', activity: [] });
  }
};