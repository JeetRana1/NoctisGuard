const axios = require('axios');

module.exports = async (req, res) => {
  const guildId = (req.query && (req.query.state || req.query.guild_id)) || null;
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const BOT_ID = process.env.BOT_ID;

  if (guildId && BOT_TOKEN && BOT_ID){
    try{
      const memberResp = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members/${BOT_ID}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
      // no-op; we don't persist cache here in serverless env
    }catch(e){ /* ignore */ }
  }

  if (guildId){
    res.writeHead(302, { Location: `/server-dashboard.html?id=${encodeURIComponent(guildId)}` });
  } else {
    res.writeHead(302, { Location: `/dashboard.html` });
  }
  res.end();
};