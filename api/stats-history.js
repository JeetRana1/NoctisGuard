const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const p = path.join(process.cwd(), 'data', 'stats.json');
    const raw = fs.readFileSync(p, 'utf8') || '{}';
    const obj = JSON.parse(raw || '{}');
    const history = Array.isArray(obj.history) ? obj.history : [];
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ history });
  } catch (err) {
    console.warn('api/stats-history error', err && err.message);
    return res.status(500).json({ history: [] });
  }
};