module.exports = (req, res) => {
  const botId = process.env.DISCORD_CLIENT_ID;
  const perms = process.env.DISCORD_PERMISSIONS || '8';
  if (!botId) {
    res.statusCode = 500; res.setHeader('content-type','text/plain; charset=utf-8'); return res.end('Server not configured with Discord client ID for invites. Set DISCORD_CLIENT_ID.');
  }
  const enableRedirect = process.env.ENABLE_INVITE_REDIRECT === 'true';

  const paramsObj = { client_id: botId, permissions: perms, scope: 'bot' };
  if (req.query && req.query.guild_id) {
    paramsObj.guild_id = req.query.guild_id;
    paramsObj.disable_guild_select = 'true';
    if (enableRedirect) {
      paramsObj.response_type = 'code';
      paramsObj.redirect_uri = `${process.env.BASE_URL}/invite-callback`;
      paramsObj.state = req.query.guild_id;
    }
  }

  const params = new URLSearchParams(paramsObj);
  res.writeHead(302, { Location: `https://discord.com/api/oauth2/authorize?${params.toString()}` });
  res.end();
};