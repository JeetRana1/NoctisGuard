const fs = require('fs');
const path = require('path');

function readJson(p, def){ try{ const raw = fs.readFileSync(p,'utf8'); return JSON.parse(raw||'[]'); }catch(e){ return def === undefined ? null : def; } }

module.exports = (req, res) => {
  try{
    const url = req.url || '';
    const q = req.query || {};
    const op = q.op || (url.split('/')[2] || '').split('?')[0]; // fallback
    const guildId = q.guildId || q.id || url.split('/')[3] || null;

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
      // No giveaways data in repo; return empty array
      return res.json({ guildId, giveaways: [] });
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

    return res.status(404).json({ error: 'Not found' });
  }catch(e){ console.error('server-proxy error', e); return res.status(500).json({ error: 'Internal error' }); }
};