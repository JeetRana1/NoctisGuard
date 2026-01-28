const axios = require('axios');

module.exports = async (req, res) => {
  try{
    const guildId = req.query.state || req.query.guild_id || null;

    // If we have a bot token, attempt to check bot presence in that guild to give faster UX
    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
    const BOT_ID = process.env.DISCORD_BOT_ID || process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;

    if (guildId && BOT_TOKEN && BOT_ID){
      try{
        const r = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members/${BOT_ID}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
        // we won't try to mutate any dashboard cache here (serverless function is stateless)
      }catch(e){ /* non-fatal */ }
    }

    if (guildId){
      // forward user back to server dashboard for that guild
      return res.redirect(`/server-dashboard.html?id=${encodeURIComponent(guildId)}`);
    }

    return res.redirect('/dashboard.html');
  }catch(e){ console.error('invite callback error', e); return res.status(500).send('Invite callback failed'); }
};