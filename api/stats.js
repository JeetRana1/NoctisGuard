const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const p = path.join(process.cwd(), 'data', 'stats.json');
    const raw = fs.readFileSync(p, 'utf8') || '{}';
    const obj = JSON.parse(raw || '{}');
    const uptimeStart = Number(obj.uptimeStart) || Date.now();
    const uptimeHours = Math.floor((Date.now() - uptimeStart) / (1000 * 60 * 60));

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      guildCount: typeof obj.guildCount === 'number' ? obj.guildCount : 0,
      totalMembers: typeof obj.totalMembers === 'number' ? obj.totalMembers : 0,
      commandsToday: typeof obj.commandsToday === 'number' ? obj.commandsToday : 0,
      uptimeHours,
      lastUpdated: obj.lastUpdated || null
    });
  } catch (err) {
    console.warn('api/stats error', err && err.message);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
};