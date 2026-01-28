const axios = require('axios');

function parseCookies(cookieHeader){
  const out = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(';');
  for (const p of pairs){ const idx = p.indexOf('='); if (idx<0) continue; const k = p.slice(0,idx).trim(); const v = p.slice(idx+1).trim(); out[k]=v; }
  return out;
}

module.exports = async (req, res) => {
  try{
    const cookies = parseCookies(req.headers && req.headers.cookie);
    if (cookies && cookies.ng_user){
      try{ const u = JSON.parse(decodeURIComponent(cookies.ng_user)); return res.json({ user: u }); }catch(e){ /* fall through */ }
    }

    // If a bearer token exists in cookie, try to fetch user from Discord
    const token = cookies && (cookies.ng_token || (req.headers && (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i,''))));
    if (token){
      try{
        const r = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${decodeURIComponent(token)}` }, timeout: 5000, validateStatus: () => true });
        if (r.status === 200 && r.data){
          // set cookie for convenience in future requests (non-HttpOnly to allow client-side reading)
          try{ res.setHeader('Set-Cookie', [`ng_user=${encodeURIComponent(JSON.stringify(r.data))}; Max-Age=${24*60*60}; Path=/`]); }catch(e){}
          return res.json({ user: r.data });
        }
      }catch(e){ /* ignore */ }
    }

    // Not authenticated
    return res.status(401).json({ error: 'Not authenticated' });
  }catch(e){ console.error('api/me error', e); return res.status(500).json({ error: 'Internal error' }); }
};