const fs = require('fs');
const path = require('path');

function readJson(p, def){ try{ const raw = fs.readFileSync(p,'utf8'); return JSON.parse(raw||'[]'); }catch(e){ return def === undefined ? null : def; } }
function writeJson(p, obj){ try{ fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }catch(e){}}

// This fake webhook accepts the same payloads the dashboard sends for plugin_test and plugin_config
// It updates activity.json and, for plugin_config updates, writes to plugin-configs.json so the dashboard can reflect changes.

async function handleWebhook(payload, headers){
  try{
    const dataDir = path.join(process.cwd(), 'data');
    const type = payload && payload.type;
    if (!type) return { ok: false, error: 'missing type' };

    if (type === 'plugin_test'){
      const { guildId, pluginId, payload: pl } = payload;
      const actPath = path.join(dataDir, 'activity.json');
      const arr = readJson(actPath, []) || [];
      const entry = { guildId: String(guildId), type: 'plugin_test', pluginId, payload: pl || null, user: headers && headers['x-sim-user'] ? { username: headers['x-sim-user'] } : null, ts: Date.now() };
      arr.unshift(entry);
      if (arr.length > 1000) arr.length = 1000;
      try{ writeJson(actPath, arr); }catch(e){ console.warn('fake webhook: failed to write activity.json', e); return { ok: true, handled: true, warning: 'write failed' }; }
      return { ok: true, handled: true };
    }

    if (type === 'plugin_config_update'){
      const { guildId, pluginId, config } = payload;
      const cfgPath = path.join(dataDir, 'plugin-configs.json');
      const all = readJson(cfgPath, {}) || {};
      all[guildId] = all[guildId] || {};
      all[guildId][pluginId] = config || all[guildId][pluginId] || {};
      writeJson(cfgPath, all);
      // record activity
      const actPath = path.join(dataDir, 'activity.json');
      const arr = readJson(actPath, []) || [];
      const entry = { guildId: String(guildId), type: 'plugin_config_update', pluginId, config, user: headers && headers['x-sim-user'] ? { username: headers['x-sim-user'] } : null, ts: Date.now() };
      arr.unshift(entry);
      if (arr.length > 1000) arr.length = 1000;
      try{ writeJson(actPath, arr); }catch(e){ console.warn('fake webhook: failed to write activity.json', e); return { ok: true, updated: true, warning: 'write failed' }; }
      return { ok: true, updated: true };
    }

    // unknown types: just log to activity
    const actPath = path.join(dataDir, 'activity.json');
    const arr = readJson(actPath, []) || [];
    arr.unshift({ guildId: payload.guildId || null, type: payload.type || 'unknown', payload: payload, ts: Date.now() });
    if (arr.length > 1000) arr.length = 1000;
    writeJson(actPath, arr);
    return { ok: true };
  }catch(e){ console.error('fake-bot-webhook error', e); return { ok: false, error: String(e) }; }
}

// HTTP handler
module.exports = async (req, res) => {
  try{
    if (String(req.method || 'GET').toUpperCase() !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    let body = req.body || null;
    if (!body){ try{ let raw = ''; for await (const chunk of req) raw += chunk; body = raw ? JSON.parse(raw) : {}; }catch(e){ body = {}; } }
    const result = await handleWebhook(body, req.headers || {});
    return res.json(result);
  }catch(e){ console.error('fake-bot-webhook HTTP error', e); return res.status(500).json({ ok: false, error: 'internal' }); }
};

// helper for direct calls from other server functions
module.exports.handleWebhook = handleWebhook;