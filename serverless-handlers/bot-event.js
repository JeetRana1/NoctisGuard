const fs = require('fs').promises;
const path = require('path');

module.exports = async (req, res) => {
  try{
    // Only accept POST
    if ((req.method || 'GET').toUpperCase() !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const secret = (req.headers && (req.headers['x-dashboard-secret'] || req.headers['x-dashboard_secret'])) || '';
    const allowed = [];
    if (process.env.BOT_NOTIFY_SECRET) allowed.push(process.env.BOT_NOTIFY_SECRET);
    if (process.env.WEBHOOK_SECRET) allowed.push(process.env.WEBHOOK_SECRET);
    // If no secret configured, we still allow localhost calls (not applicable on Vercel), otherwise require secret
    const remote = (req.headers['x-forwarded-for'] || req.connection && req.connection.remoteAddress || '').replace('::ffff:', '');
    const isLocal = remote === '127.0.0.1' || remote === '::1' || remote === '';
    if (allowed.length > 0 && !allowed.includes(secret)) return res.status(403).json({ error: 'Forbidden' });

    const body = req.body || {};
    const type = body.type;
    const guildId = body.guildId || body.guild || body.guild_id || null;

    // record activity
    try{
      const ACTIVITY_FILE = path.join(process.cwd(), 'data', 'activity.json');
      const raw = await fs.readFile(ACTIVITY_FILE, 'utf8').catch(()=>null);
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift({ type: type || 'unknown', guildId, payload: body, ts: Date.now() });
      if (arr.length > 300) arr.splice(300);
      await fs.mkdir(path.dirname(ACTIVITY_FILE), { recursive: true });
      await fs.writeFile(ACTIVITY_FILE, JSON.stringify(arr, null, 2));
    }catch(e){ console.warn('bot-event: failed to append activity', e); }

    // Handle known event types
    if (type === 'guild_joined' || type === 'joined'){
      try{
        const pf = path.join(process.cwd(), 'data', 'presences.json');
        const raw = await fs.readFile(pf, 'utf8').catch(()=>null);
        const all = raw ? JSON.parse(raw) : {};
        // mark presence as containing bot id when available
        const botId = process.env.DISCORD_BOT_ID || process.env.DISCORD_CLIENT_ID || null;
        const arr = all[guildId] || [];
        if (botId && !arr.find(x => String(x.id) === String(botId))){ arr.push({ id: String(botId), status: 'online' }); }
        all[guildId] = arr;
        await fs.mkdir(path.dirname(pf), { recursive: true });
        await fs.writeFile(pf, JSON.stringify(all, null, 2));
      }catch(e){ console.warn('bot-event: failed to update presences', e); }
      return res.json({ ok: true });
    }

    if (type === 'guild_left' || type === 'left' || type === 'guild_deleted'){
      try{
        const pf = path.join(process.cwd(), 'data', 'presences.json');
        const raw = await fs.readFile(pf, 'utf8').catch(()=>null);
        const all = raw ? JSON.parse(raw) : {};
        all[guildId] = [];
        await fs.mkdir(path.dirname(pf), { recursive: true });
        await fs.writeFile(pf, JSON.stringify(all, null, 2));
      }catch(e){ console.warn('bot-event: failed to clear presences', e); }
      return res.json({ ok: true });
    }

    if (type === 'stats_update' || type === 'stats'){
      try{
        const sf = path.join(process.cwd(), 'data', 'stats.json');
        const raw = await fs.readFile(sf, 'utf8').catch(()=>null);
        const cur = raw ? JSON.parse(raw) : {};
        const stats = body.stats || body.data || {};
        if (typeof stats.guildCount === 'number') cur.guildCount = stats.guildCount;
        if (typeof stats.totalMembers === 'number') cur.totalMembers = stats.totalMembers;
        cur.lastUpdated = Date.now();
        cur.history = cur.history || [];
        await fs.mkdir(path.dirname(sf), { recursive: true });
        await fs.writeFile(sf, JSON.stringify(cur, null, 2));
      }catch(e){ console.warn('bot-event: failed to update stats', e); }
      return res.json({ ok: true });
    }

    // Unknown event type
    return res.status(400).json({ error: 'Unknown type' });
  }catch(e){ console.error('bot-event handler failed', e); return res.status(500).json({ error: 'failed', message: String(e) }); }
};