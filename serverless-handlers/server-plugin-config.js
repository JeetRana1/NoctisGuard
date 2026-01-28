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

    // If a BOT_NOTIFY_URL is configured, try to proxy GET/POST to the bot instead of relying on ephemeral local files
    const BOT_URL = (process.env.BOT_NOTIFY_URL || '').replace(/\/$/, '');
    const headers = {};
    if (process.env.BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = process.env.BOT_NOTIFY_SECRET;

    if (req.method === 'GET'){
      // require auth
      if (!token) return res.status(401).json({ error: 'Not authenticated' });
      if (BOT_URL){
        try{
          const r = await require('axios').get(`${BOT_URL}/server-plugin-config/${encodeURIComponent(guildId)}`, { headers, timeout: 5000, validateStatus: () => true });
          if (r && r.status >= 200 && r.status < 300 && r.data) return res.json({ guildId, config: r.data.config || r.data });
        }catch(e){ /* fall back to local file */ }
      }
      const all = await load();
      return res.json({ guildId, config: all[guildId] || {} });
    }

    // POST -> set config (auth required)
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const body = req.body || {};

    // If bot webhook is configured, forward the plugin_config notification to the bot
    if (BOT_URL){
      try{
        const payload = { type: 'plugin_config', guildId, pluginId: body.pluginId || null, config: (body.pluginId ? body.config : (body.config || body)) };
        await require('axios').post(BOT_URL, payload, { headers, timeout: 8000, validateStatus: () => true });
      }catch(e){ console.warn('Failed to forward plugin-config to bot', e?.message || e); }
    }

    // Always persist locally as a fallback for non-persistent hosting
    const all = await load();
    const prev = all[guildId] || {};
    const current = { ...prev };
    if (body.pluginId && typeof body.config === 'object') current[body.pluginId] = body.config;
    else if (typeof body.config === 'object') Object.assign(current, body.config);
    else if (typeof body === 'object') Object.assign(current, body);
    all[guildId] = current;
    await save(all);
    return res.json({ ok: true, guildId, config: current });
  }catch(e){ console.error('server-plugin-config error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};