// Simple /api/me endpoint for serverless deploys
module.exports = async (req, res) => {
  try{
    const cookieHeader = req.headers.cookie || '';
    const cookies = {};
    cookieHeader.split(';').map(s=>s.trim()).forEach(p => { const idx = p.indexOf('='); if (idx > -1){ const k = p.slice(0,idx); const v = p.slice(idx+1); cookies[k] = v; }});
    const raw = cookies['ng_user'];
    if (!raw) return res.json({ user: null });
    try{
      const user = JSON.parse(decodeURIComponent(raw));
      return res.json({ user });
    }catch(e){ return res.status(500).json({ error: 'Malformed user cookie' }); }
  }catch(e){ return res.status(500).json({ error: 'failed', message: String(e) }); }
};