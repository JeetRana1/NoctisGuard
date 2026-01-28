const fs = require('fs');
const path = require('path');
const axios = require('axios');

function readJson(p, def){ try{ const raw = fs.readFileSync(p,'utf8'); return JSON.parse(raw||'[]'); }catch(e){ return def === undefined ? null : def; } }
function writeJson(p, obj){ try{ fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }catch(e){}
}
function parseCookies(cookieHeader){ const out = {}; if (!cookieHeader) return out; const pairs = cookieHeader.split(';'); for (const p of pairs){ const idx = p.indexOf('='); if (idx<0) continue; const k = p.slice(0,idx).trim(); const v = p.slice(idx+1).trim(); out[k]=v; } return out; }

module.exports = async (req, res) => {
  try{
    const url = req.url || '';
    const q = req.query || {};
    const op = q.op || (url.split('/')[2] || '').split('?')[0]; // fallback
    const guildId = q.guildId || q.id || (url.split('/')[3] || null);

    // normalize op variants
    // op may be 'server-plugins' or 'server-plugin-config' etc
    if (!op) return res.status(400).json({ error: 'missing op' });

    // data paths
    const dataDir = path.join(process.cwd(), 'data');

    if (op === 'server-plugins'){
      const obj = readJson(path.join(dataDir, 'plugins.json'), {}); const state = obj[guildId] || {}; return res.json({ guildId, state });
    }

    if (op === 'server-plugin-config'){
      const obj = readJson(path.join(dataDir, 'plugin-configs.json'), {}); const cfg = obj[guildId] || {}; return res.json({ guildId, config: cfg });
    }

    if (op === 'guild-presences'){
      const obj = readJson(path.join(dataDir, 'presences.json'), {}); const arr = obj[guildId] || []; return res.json({ guildId, presences: arr });
    }

    if (op === 'server-activity'){
      const arr = readJson(path.join(dataDir, 'activity.json'), []) || []; const filtered = arr.filter(a => String(a.guildId) === String(guildId)); const limit = Math.min(200, Number(q.limit || 50)); return res.json({ guildId, activity: filtered.slice(0, limit) });
    }

    if (op === 'server-giveaways'){
      // synthesize giveaways from recent plugin_test activity entries if present
      const arr = readJson(path.join(dataDir, 'activity.json'), []) || [];
      const tests = arr.filter(x => x.guildId === String(guildId) && x.type === 'plugin_test' && x.pluginId && String(x.pluginId).toLowerCase().includes('giveaway')) || [];
      const out = tests.slice(0,10).map((t,i) => ({ id: `test-${i}-${t.ts}`, prize: t.payload && t.payload.config && t.payload.config.giveaway && t.payload.config.giveaway.prize ? t.payload.config.giveaway.prize : 'Test giveaway', type: 'test', ts: t.ts }));
      return res.json({ guildId, giveaways: out });
    }

    if (op === 'guild'){ // return basic guild metadata + bot presence if available
      const pres = readJson(path.join(process.cwd(), 'data', 'presences.json'), {}) || {};
      const arr = pres[guildId] || [];
      // Determine bot presence: either BOT_ID env or hard-coded sniff from presence list
      const botId = process.env.BOT_ID || null;
      let bot_present = false;
      if (botId){ bot_present = arr.some(m => String(m.id) === String(botId)); }
      else { bot_present = arr && arr.length > 0; }
      return res.json({ id: guildId, name: null, icon: null, bot_present });
    }

    // recent guild events
    if (op === 'recent-guild-events'){
      const arr = readJson(path.join(process.cwd(), 'data', 'activity.json'), []) || [];
      const cutoff = Date.now() - (10*60*1000);
      const recent = (arr || []).filter(a => (a && (a.ts || a.at) && ((a.ts||a.at) >= cutoff))).map(a => ({ at: (a.ts||a.at), type: a.type, guildId: a.guildId, pluginId: a.pluginId, user: a.user }));
      return res.json({ events: recent });
    }

    // Guild members: try bot presence proxy or bot token if available
    if (op === 'guild-members'){
      const limit = Math.min(200, Number(q.limit || 25));
      const presenceBase = process.env.BOT_PRESENCE_URL;
      const headers = {};
      if (process.env.BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = process.env.BOT_NOTIFY_SECRET;
      if (presenceBase){
        try{
          const r = await axios.get(`${presenceBase.replace(/\/$/,'')}/guild-members/${encodeURIComponent(guildId)}?limit=${limit}`, { headers, timeout: 5000, validateStatus: () => true });
          if (r && r.status >=200 && r.status < 300) return res.json(r.data);
        }catch(e){ console.warn('Presence proxy failed', e?.message || e); }
      }

      // If BOT token is configured, try directly against Discord (may not be available in serverless env)
      const BOT_TOKEN = process.env.BOT_TOKEN;
      if (BOT_TOKEN){
        try{
          const r = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members?limit=${limit}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 8000, validateStatus: () => true });
          if (r && r.status === 200){
            const members = (r.data || []).map(m => ({ id: m.user?.id, username: m.user?.username, discriminator: m.user?.discriminator, avatar: m.user?.avatar }));
            return res.json({ guildId, members });
          }
          return res.status(r.status || 500).json({ error: 'Failed to fetch members', details: r.data });
        }catch(e){ console.warn('Failed to fetch members from Discord', e?.message || e); return res.status(500).json({ error: 'Failed to fetch members' }); }
      }

      return res.status(501).json({ error: 'Presence proxy or bot token not configured' });
    }

    // Server plugin test: forward test to bot webhook and record activity
    if (op === 'server-plugin-test'){
      if (String(req.method || 'GET').toUpperCase() !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const cookies = parseCookies(req.headers && req.headers.cookie);
      const token = cookies && cookies.ng_token;
      if (!token) return res.status(401).json({ error: 'Not authenticated' });

      // parse JSON body (try req.body or fallback to raw)
      let body = req.body || null;
      if (!body){
        try{ let raw = ''; for await (const chunk of req) raw += chunk; body = raw ? JSON.parse(raw) : {}; }catch(e){ body = {}; }
      }
      const pluginId = body.pluginId || 'welcome';
      const testType = body.testType || 'welcome';
      const payload = { testType, userId: body.userId || null, config: body.config || body.payload || null };

      // record activity into data/activity.json (prepend)
      try{
        const actPath = path.join(dataDir, 'activity.json');
        const arr = readJson(actPath, []) || [];
        const userJson = cookies && cookies.ng_user ? (()=>{ try{return JSON.parse(decodeURIComponent(cookies.ng_user)); }catch(e){return null;} })() : null;
        const entry = { guildId: String(guildId), type: 'plugin_test', pluginId, payload, user: userJson ? { id: userJson.id, username: `${userJson.username || 'Unknown'}${userJson.discriminator ? ('#'+userJson.discriminator):''}` } : null, ts: Date.now() };
        arr.unshift(entry);
        // cap at 1000 entries
        if (arr.length > 1000) arr.length = 1000;
        writeJson(actPath, arr);
      }catch(e){ console.warn('Failed to append plugin_test activity', e); }

      // Notify bot webhook (if configured)
      let result = null;
      const BOT_NOTIFY_URL = process.env.BOT_NOTIFY_URL;
      const headers = {};
      if (process.env.BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = process.env.BOT_NOTIFY_SECRET;
      if (BOT_NOTIFY_URL){
        try{
          const r = await axios.post(BOT_NOTIFY_URL, { type: 'plugin_test', guildId, pluginId, payload }, { headers, timeout: 8000, validateStatus: () => true });
          result = { status: r.status, body: r.data };
        }catch(e){ console.warn('Failed to notify bot of plugin_test', e?.message || e); }
      } else {
        // No external BOT_NOTIFY_URL configured — use local fake-bot-webhook to simulate the bot so the dashboard can still test plugins
        try{
          const fake = require('./fake-bot-webhook');
          const r = await fake.handleWebhook({ type: 'plugin_test', guildId, pluginId, payload }, headers);
          result = { status: 200, body: r };
        }catch(e){ console.warn('Fake webhook failed', e); }
      }

      return res.json({ ok: true, result });
    }

    return res.status(404).json({ error: 'Not found' });
  }catch(e){ console.error('server-proxy error', e); return res.status(500).json({ error: 'Internal error' }); }
};