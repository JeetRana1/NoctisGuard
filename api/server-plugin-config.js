const fs = require('fs').promises;
const path = require('path');

const CFG = path.join(process.cwd(), 'data', 'plugin-configs.json');
async function load(){ try{ const raw = await fs.readFile(CFG, 'utf8'); return JSON.parse(raw || '{}'); }catch(e){ return {}; } }
async function save(obj){ try{ await fs.mkdir(path.dirname(CFG), { recursive: true }); await fs.writeFile(CFG, JSON.stringify(obj, null, 2), 'utf8'); }catch(e){ console.warn('Failed to save plugin-configs', e); } }

module.exports = async (req, res) => {
  try{
    const cookieHeader = req.headers.cookie || '';
    const cookies = {}; cookieHeader.split(';').map(s=>s.trim()).forEach(p => { const idx = p.indexOf('='); if (idx>-1){ cookies[p.slice(0,idx)] = p.slice(idx+1); }});
    const token = cookies['ng_token'];
    const guildId = req.query.guildId || (req.url && req.url.split('/').pop()) || null;
    if (!guildId) return res.status(400).json({ error: 'Missing guildId' });
    const all = await load();
    if (req.method === 'GET'){
      // require auth
      if (!token) return res.status(401).json({ error: 'Not authenticated' });
      return res.json({ guildId, config: all[guildId] || {} });
    }
    // POST -> set config (auth required)
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const body = req.body || {};
    const prev = all[guildId] || {};
    const current = { ...prev };
    if (body.pluginId && typeof body.config === 'object') current[body.pluginId] = body.config;
    else if (typeof body.config === 'object') Object.assign(current, body.config);
    else if (typeof body === 'object') Object.assign(current, body);
    all[guildId] = current; await save(all);
    return res.json({ ok: true, guildId, config: current });
  }catch(e){ console.error('server-plugin-config error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};