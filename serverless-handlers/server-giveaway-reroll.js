const axios = require('axios');
const { appendActivity } = require('./storage-utils');

module.exports = async (req, res) => {
  try{
    if ((req.method || 'GET').toUpperCase() !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    // Auth check
    const cookieHeader = req.headers.cookie || '';
    const cookies = {};
    cookieHeader.split(';').map(s=>s.trim()).forEach(p => { const idx = p.indexOf('='); if (idx > -1){ const k = p.slice(0,idx); const v = p.slice(idx+1); cookies[k] = v; }});
    const rawToken = cookies['ng_token'];
    if (!rawToken) return res.status(401).json({ error: 'Not authenticated' });

    const parts = req.url.split('/');
    const guildId = parts.pop().split('?')[0] || null;
    if (!guildId) return res.status(400).json({ error: 'Missing guildId' });

    const body = req.body || {};
    const giveawayId = body.giveawayId;
    if (!giveawayId) return res.status(400).json({ error: 'Missing giveawayId' });

    // Record activity
    try{
      const user = (() => { try{ const userRaw = req.headers.cookie && req.headers.cookie.split(';').map(s=>s.trim()).find(x => x.startsWith('ng_user=')); if (userRaw){ return JSON.parse(decodeURIComponent(userRaw.slice(8))); } }catch(e){} return null; })();
      await appendActivity({ guildId, type: 'giveaway_reroll_requested', payload: { giveawayId }, user: (user ? { id: user.id, username: user.username+'#'+user.discriminator } : null), ts: Date.now() }, 300);
    }catch(e){ console.warn('server-giveaway-reroll: failed to append activity', e); }

    // Check if bot webhook is configured
    if (!process.env.BOT_NOTIFY_URL) {
      return res.json({ 
        ok: false, 
        error: 'bot_not_configured',
        message: 'Bot webhook URL is not configured'
      });
    }

    // Forward to bot
    try{
      const botUrl = process.env.BOT_NOTIFY_URL.replace(/\/$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = process.env.BOT_NOTIFY_SECRET;
      
      const resp = await axios.post(botUrl, { 
        type: 'giveaway_action', 
        guildId, 
        action: 'reroll', 
        payload: { giveawayId } 
      }, { headers, timeout: 60000, validateStatus: () => true });
      
      if (resp && resp.status >= 200 && resp.status < 300) {
        return res.json({ ok: true, result: resp.data });
      }
      
      return res.json({ 
        ok: false, 
        error: 'bot_failure', 
        status: resp && resp.status,
        data: resp && resp.data 
      });
    }catch(e){ 
      console.warn('server-giveaway-reroll: failed to contact bot', e && e.message ? e.message : e);
      return res.json({ 
        ok: false, 
        error: 'bot_unreachable', 
        message: String(e.message || e)
      });
    }

  }catch(e){ 
    console.error('server-giveaway-reroll failed', e); 
    return res.status(500).json({ error: 'failed', message: String(e) }); 
  }
};