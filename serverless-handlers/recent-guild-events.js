const { readJSON } = require('./storage-utils');

module.exports = async (req, res) => {
  try{
    const arr = await readJSON('activity.json', []);
    // Map activity entries to a minimal event: { type, guildId, at }
    const events = (arr || []).slice(-50).reverse().map(x => ({ type: x.type, guildId: x.guildId || x.guild_id || null, at: x.ts || x.t || Date.now() }));
    return res.json({ events });
  }catch(e){ console.error('recent-guild-events error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};