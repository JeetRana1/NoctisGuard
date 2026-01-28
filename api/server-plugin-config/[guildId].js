const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const guildId = req.query && (req.query.guildId || req.query.id) || req.query?.guildId || '';
    const p = path.join(process.cwd(), 'data', 'plugin-configs.json');
    const raw = fs.readFileSync(p, 'utf8') || '{}';
    const obj = JSON.parse(raw || '{}');
    const config = obj[guildId] || {};
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ guildId, config });
  } catch (err) {
    console.warn('api/server-plugin-config error', err && err.message);
    return res.status(500).json({ error: 'Failed to load plugin config' });
  }
};