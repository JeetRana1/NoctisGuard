const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const guildId = req.query && (req.query.guildId || req.query.id) || req.query?.guildId || '';
    const p = path.join(process.cwd(), 'data', 'presences.json');
    const raw = fs.readFileSync(p, 'utf8') || '{}';
    const obj = JSON.parse(raw || '{}');
    const presences = (obj && obj[guildId]) || [];
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ guildId, presences });
  } catch (err) {
    console.warn('api/guild-presences error', err && err.message);
    return res.status(500).json({ guildId: req.query && req.query.guildId || '', presences: [] });
  }
};