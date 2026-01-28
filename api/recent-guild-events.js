const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try{
    const dataPath = path.join(__dirname, '..', 'data', 'activity.json');
    let raw = '[]';
    try{ raw = fs.readFileSync(dataPath, 'utf8'); }catch(e){ /* no file or unreadable -> empty */ }
    const arr = JSON.parse(raw || '[]');
    const cutoff = Date.now() - (10*60*1000);
    const recent = (arr || []).filter(a => (a && (a.ts || a.at) && ( (a.ts||a.at) >= cutoff )) ).map(a => ({ at: (a.ts || a.at), type: a.type, guildId: a.guildId, pluginId: a.pluginId, user: a.user }));
    return res.json({ events: recent });
  }catch(e){ console.error('recent-guild-events error', e); return res.status(500).json({ events: [] }); }
};