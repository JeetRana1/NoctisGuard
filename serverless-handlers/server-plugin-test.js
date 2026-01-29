const axios = require('axios');
const { appendActivity } = require('./storage-utils');

module.exports = async (req, res) => {
  try{
    if ((req.method || 'GET').toUpperCase() !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    // auth
    const cookieHeader = req.headers.cookie || '';
    const cookies = {};
    cookieHeader.split(';').map(s=>s.trim()).forEach(p => { const idx = p.indexOf('='); if (idx > -1){ const k = p.slice(0,idx); const v = p.slice(idx+1); cookies[k] = v; }});
    const rawToken = cookies['ng_token'];
    if (!rawToken) return res.status(401).json({ error: 'Not authenticated' });

    const token = decodeURIComponent(rawToken);
    const parts = req.url.split('/');
    const guildId = parts.pop().split('?')[0] || null;
    if (!guildId) return res.status(400).json({ error: 'Missing guildId' });

    const body = req.body || {};
    const pluginId = body.pluginId || 'welcome';
    const testType = body.testType || 'welcome';
    const payload = { testType, userId: body.userId || null, config: body.config || body.payload || null };

    // record activity
    try{
      const user = (() => { try{ const userRaw = req.headers.cookie && req.headers.cookie.split(';').map(s=>s.trim()).find(x => x.startsWith('ng_user=')); if (userRaw){ return JSON.parse(decodeURIComponent(userRaw.slice(8))); } }catch(e){} return null; })();
      await appendActivity({ guildId, type: 'plugin_test', pluginId, payload, user: (user ? { id: user.id, username: user.username+'#'+user.discriminator } : null), ts: Date.now() }, 300);
    }catch(e){ console.warn('server-plugin-test: failed to append activity', e); }

    // Forward test to bot webhook
    try{
      if (!process.env.BOT_NOTIFY_URL) return res.status(502).json({ error: 'BOT_NOTIFY_URL not configured' });
      const base = process.env.BOT_NOTIFY_URL.replace(/\/$/, '');
      const url = base + '/webhook';
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = process.env.BOT_NOTIFY_SECRET;
      const resp = await axios.post(url, { type: 'plugin_test', guildId, pluginId, payload }, { headers, timeout: 10000, validateStatus: () => true });
      if (resp && resp.status >= 200 && resp.status < 300) return res.json({ ok: true, result: resp.data });
      console.warn('server-plugin-test: bot returned non-2xx', resp && resp.status, resp && resp.data);
      return res.status(502).json({ ok: false, error: 'bot_failure', status: resp && resp.status, data: resp && resp.data });
    }catch(e){ console.warn('server-plugin-test: failed to contact bot', e && e.message ? e.message : e); return res.status(502).json({ ok: false, error: 'bot_unreachable', message: String(e) }); }

  }catch(e){ console.error('server-plugin-test failed', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};