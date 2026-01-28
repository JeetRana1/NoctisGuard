const axios = require('axios');

const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

module.exports = async (req, res) => {
  const code = req.query && req.query.code;
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

  if (!code) {
    res.statusCode = 400; res.setHeader('content-type','text/plain; charset=utf-8'); return res.end('Missing code');
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.statusCode = 500; res.setHeader('content-type','text/plain; charset=utf-8'); return res.end('Server not configured with Discord client credentials. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.');
  }
  if (!BASE_URL) {
    res.statusCode = 500; res.setHeader('content-type','text/plain; charset=utf-8'); return res.end('BASE_URL not configured.');
  }

  try {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: `${BASE_URL}/callback`
    });

    const tokenResp = await axios.post('https://discord.com/api/oauth2/token', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const access_token = tokenResp.data && tokenResp.data.access_token;
    if (!access_token) throw new Error('No access token received');

    // fetch user
    const userResp = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
    const user = userResp.data;

    // Set cookies (not HttpOnly to mirror local dev behavior)
    const cookies = [];
    // Use SameSite=None and Secure so the cookies are accepted after cross-site OAuth redirects
    const cookieOpts = `Max-Age=${24*60*60}; Path=/; SameSite=None; Secure`;
    cookies.push(`ng_token=${encodeURIComponent(access_token)}; ${cookieOpts}`);
    cookies.push(`ng_user=${encodeURIComponent(JSON.stringify(user))}; ${cookieOpts}`);

    // Set cookies server-side (best-effort)
    res.setHeader('Set-Cookie', cookies);
    // Also return a small HTML + JS fallback to set cookies client-side and redirect — helps when Set-Cookie is blocked
    const safeToken = encodeURIComponent(access_token);
    const safeUser = encodeURIComponent(JSON.stringify(user));
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signing you in…</title></head><body><script>
try{
  document.cookie = "ng_token=${safeToken}; Max-Age=${24*60*60}; Path=/; SameSite=None; Secure";
  document.cookie = "ng_user=${safeUser}; Max-Age=${24*60*60}; Path=/; SameSite=None; Secure";
}catch(e){}
location.replace('/dashboard.html');
</script><p>Signing you in… If you are not redirected, <a href="/dashboard.html">click here</a>.</p></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).end(html);
  } catch (err) {
    console.error('OAuth callback error', err.response?.data || err.message || err);
    res.statusCode = 500; res.setHeader('content-type','text/plain; charset=utf-8');
    return res.end('OAuth callback error');
  }
};