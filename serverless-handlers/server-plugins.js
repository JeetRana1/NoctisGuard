const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const PLUGINS_FILE = path.join(process.cwd(), 'data', 'plugins.json');

async function load(){ try{ const raw = await fs.readFile(PLUGINS_FILE, 'utf8'); return JSON.parse(raw || '{}'); }catch(e){ return {}; } }
async function save(obj){ try{ await fs.mkdir(path.dirname(PLUGINS_FILE), { recursive: true }); await fs.writeFile(PLUGINS_FILE, JSON.stringify(obj, null, 2), 'utf8'); }catch(e){ console.warn('Failed to save plugins file', e); } }

module.exports = async (req, res) => {
  try{
    // Require auth: check cookie ng_token
    const cookieHeader = req.headers.cookie || '';
    const cookies = {}; cookieHeader.split(';').map(s=>s.trim()).forEach(p => { const idx = p.indexOf('='); if (idx>-1){ cookies[p.slice(0,idx)] = p.slice(idx+1); }});
    const token = cookies['ng_token'];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const guildId = req.query.guildId || (req.url && req.url.split('/').pop()) || null;
    if (!guildId) return res.status(400).json({ error: 'Missing guildId' });

    const all = await load();

    if (req.method === 'GET'){
      return res.json({ guildId, state: all[guildId] || {} });
    }

    // POST: accept pluginId+enabled or full state
    const body = req.body || {};
    const prev = all[guildId] || {};
    const current = { ...prev };
    if (typeof body.pluginId === 'string') { current[body.pluginId] = !!body.enabled; }
    else if (body.state && typeof body.state === 'object'){ Object.assign(current, body.state); }
    else if (typeof body === 'object'){ Object.assign(current, body); }

    // If BOT_NOTIFY_URL is set, forward the plugin update to the bot
    const BOT_URL = (process.env.BOT_NOTIFY_URL || '').replace(/\/$/, '');
    const headers = {};
    if (process.env.BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = process.env.BOT_NOTIFY_SECRET;
    if (BOT_URL){
      try{
        await axios.post(BOT_URL, { type: 'plugin_update', guildId, state: current }, { headers, timeout: 8000, validateStatus: () => true });
      }catch(e){ console.warn('Failed to forward plugin update to bot', e?.message || e); }
    }

    all[guildId] = current;
    await save(all);
    return res.json({ ok: true, guildId, state: current });

  }catch(e){ console.error('server-plugins error', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};