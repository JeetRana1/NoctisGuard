const { readJSON } = require('./storage-utils');

module.exports = async (req, res) => {
  try{
    const guildId = req.query && req.query.guildId ? req.query.guildId : (req.url && req.url.split('/').pop().split('?')[0]) || null;
    // try to read data/activity.json
    const arr = await readJSON('activity.json', []);
    const items = guildId ? arr.filter(x => x.guildId === String(guildId)).slice(0,40) : [];
    return res.json({ guildId, activity: items });
  }catch(e){ console.error('server-activity error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};