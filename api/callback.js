const axios = require('axios');
const qs = require('querystring');

module.exports = async (req, res) => {
  try{
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code');

    const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
    const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || process.env.CLIENT_SECRET;
    if (!CLIENT_ID || !CLIENT_SECRET) return res.status(500).send('OAuth client not configured');

    // Derive redirect URI as exactly what Discord will use (match your app settings)
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || (req.protocol || 'https');
    const base = (process.env.BASE_URL && process.env.BASE_URL.replace(/\/$/, '')) || `${proto}://${host}`;
    const redirectUri = base + '/callback';

    // Exchange code for token
    const body = qs.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    });

    const tokenResp = await axios.post('https://discord.com/api/oauth2/token', body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const access_token = tokenResp.data && tokenResp.data.access_token;
    if (!access_token) return res.status(500).send('Token exchange failed');

    // Fetch user
    const userResp = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
    const user = userResp.data;

    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    const secure = isProd; // only set Secure in production

    // Set cookies (ng_token and ng_user) for client-side to use
    const cookieOptions = `Path=/; Max-Age=${24*60*60}; SameSite=Lax${secure ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', [`ng_token=${encodeURIComponent(access_token)}; ${cookieOptions}`, `ng_user=${encodeURIComponent(JSON.stringify(user))}; ${cookieOptions}`]);

    return res.redirect('/dashboard.html');
  }catch(e){
    console.error('OAuth callback error', e && (e.response && e.response.data) ? e.response.data : e.message || e);
    return res.status(500).send('OAuth callback failed.');
  }
};