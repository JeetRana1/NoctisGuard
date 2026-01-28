const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

module.exports = (req, res) => {
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  if (!CLIENT_ID) {
    res.statusCode = 500;
    res.setHeader('content-type','text/plain; charset=utf-8');
    return res.end('Server not configured with Discord client ID. Set DISCORD_CLIENT_ID in environment variables.');
  }
  if (!BASE_URL) {
    res.statusCode = 500;
    res.setHeader('content-type','text/plain; charset=utf-8');
    return res.end('BASE_URL not configured. Set BASE_URL in environment variables.');
  }

  const redirect = `${BASE_URL}/callback`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'identify guilds'
  });

  res.writeHead(302, { Location: `https://discord.com/api/oauth2/authorize?${params.toString()}` });
  res.end();
};