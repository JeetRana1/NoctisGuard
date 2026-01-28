require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const qs = require('querystring');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
let io = null;

const app = express();
// trust proxy headers when deployed behind a reverse-proxy (e.g., Vercel)
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;
// Prefer an explicit BASE_URL, fall back to VERCEL_URL (auto-set on Vercel) or localhost for dev
const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`);
// Accept multiple common env names for Discord app creds (ease local/.env vs hosting providers)
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || process.env.CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('Warning: DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET not set. OAuth /auth will fail until you set them in .env');
}

app.use(express.static(path.join(__dirname)));
app.use(cookieParser());
app.use(express.json()); // parse JSON bodies for API endpoints

// Simple API to return the logged-in user (from cookie)
app.get('/api/me', (req, res) => {
  const userJson = req.cookies?.ng_user;
  try {
    const user = userJson ? JSON.parse(userJson) : null;
    return res.json({ user });
  } catch (e) {
    return res.status(500).json({ error: 'Malformed user cookie' });
  }
});

// Diagnostic helpers for local dev: track last bot event and last live emit
let lastBotEvent = null; // { type, guildId, from, at }
let lastStatsEmitAt = null; // timestamp of last emit

function isLocalOrHasSecret(req){
  const secret = req.header('x-dashboard-secret') || '';
  const remote = (req.ip || (req.connection && req.connection.remoteAddress) || '').replace('::ffff:', '');
  const allowedSecrets = [];
  if (BOT_NOTIFY_SECRET) allowedSecrets.push(BOT_NOTIFY_SECRET);
  if (process.env.WEBHOOK_SECRET) allowedSecrets.push(process.env.WEBHOOK_SECRET);
  const isLocal = remote === '127.0.0.1' || remote === '::1';
  return (allowedSecrets.length > 0 && allowedSecrets.includes(secret)) || isLocal;
}

// Internal debug endpoints (protected by secret or localhost)
app.get('/internal/last-bot-event', (req, res) => {
  if (!isLocalOrHasSecret(req)) return res.status(403).json({ error: 'Forbidden' });
  return res.json({ lastBotEvent, lastStatsEmitAt });
});

app.get('/internal/stats-info', (req, res) => {
  if (!isLocalOrHasSecret(req)) return res.status(403).json({ error: 'Forbidden' });
  return res.json({ botStats, lastStatsEmitAt });
});

// Simple in-memory cache to avoid hitting Discord frequently
const guildsCache = new Map(); // key -> { guilds, expiresAt }
const CACHE_TTL_MS = 45_000; // 45 seconds
// Cache to store whether bot is present in a guild to avoid repeated API calls
const botPresenceCache = new Map(); // key -> { present, expiresAt }
const BOT_PRESENCE_TTL_MS = 60_000; // 60 seconds
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
const BOT_ID = process.env.DISCORD_BOT_ID || process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
const BOT_NOTIFY_URL = process.env.BOT_NOTIFY_URL || null; // optional webhook on the bot to notify of changes
const BOT_NOTIFY_SECRET = process.env.BOT_NOTIFY_SECRET || null; // optional shared secret sent as x-dashboard-secret header
// Bot notify timing and retry settings
const BOT_NOTIFY_TIMEOUT_MS = Number(process.env.BOT_NOTIFY_TIMEOUT_MS || 30000); // default 30s
const BOT_NOTIFY_RETRIES = Number(process.env.BOT_NOTIFY_RETRIES || 1); // number of extra retries on failure (total attempts = 1 + retries)
// Optional: poll the bot's public stats endpoint if provided (poll interval in ms)
const BOT_STATS_POLL_INTERVAL_MS = Number(process.env.BOT_STATS_POLL_INTERVAL_MS || 5*60*1000); // default 5 minutes

// Recent events published by bot -> dashboard (kept in-memory, pruned periodically)
const recentGuildEvents = []; // { type: 'guild_left'|'guild_joined', guildId, at }
function addRecentGuildEvent(evt){ try{ const now = Date.now(); recentGuildEvents.push({ ...evt, at: now }); // prune older than 10m
  const cutoff = now - (10*60*1000);
  while(recentGuildEvents.length && recentGuildEvents[0].at < cutoff) recentGuildEvents.shift(); }catch(e){} }

// Basic stats object for the public site (kept in-memory, can be updated by the bot via /bot-event)
const botStats = {
  guildCount: 0,
  totalMembers: 0,
  commandsToday: 0,
  uptimeStart: Date.now(),
  lastUpdated: Date.now(),
  history: [] // simple recent commandsToday snapshots
};

const BOT_STATS_FILE = path.join(__dirname, 'data', 'stats.json');

async function loadBotStatsFile(){
  try{
    const raw = await fs.readFile(BOT_STATS_FILE, 'utf8');
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object'){
      if (typeof obj.guildCount === 'number') botStats.guildCount = obj.guildCount;
      if (typeof obj.totalMembers === 'number') botStats.totalMembers = obj.totalMembers;
      if (typeof obj.commandsToday === 'number') botStats.commandsToday = obj.commandsToday;
      if (Array.isArray(obj.history)) botStats.history = obj.history.slice(-48);
      if (obj.uptimeStart) botStats.uptimeStart = obj.uptimeStart;
      botStats.lastUpdated = obj.lastUpdated || botStats.lastUpdated;
      console.log('Loaded bot stats from', BOT_STATS_FILE);
    }
  }catch(e){ /* ignore if missing */ }
}

async function saveBotStatsFile(){
  try{
    await fs.mkdir(path.dirname(BOT_STATS_FILE), { recursive: true });
    const out = { guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, commandsToday: botStats.commandsToday, history: botStats.history, uptimeStart: botStats.uptimeStart, lastUpdated: botStats.lastUpdated };
    await fs.writeFile(BOT_STATS_FILE, JSON.stringify(out, null, 2), 'utf8');
  }catch(e){ console.warn('Failed to save bot stats to file', e); }
}

// Helper to update botStats safely
function updateBotStats(newStats){ try{
  if (!newStats || typeof newStats !== 'object') return;
  if (typeof newStats.guildCount === 'number') botStats.guildCount = newStats.guildCount;
  if (typeof newStats.totalMembers === 'number') botStats.totalMembers = newStats.totalMembers;
  if (typeof newStats.commandsToday === 'number'){
    botStats.commandsToday = newStats.commandsToday;
    // append to history (cap at 48 samples)
    try{ botStats.history = botStats.history || []; botStats.history.push({ t: Date.now(), v: Number(newStats.commandsToday) || 0 }); if (botStats.history.length > 48) botStats.history.shift(); }catch(e){}
  }
  botStats.lastUpdated = Date.now();
  // Persist to disk asynchronously
  saveBotStatsFile().catch(()=>{});

  // Emit live update to connected clients (if socket.io is available)
  try{
    if (io){
      const uptimeHours = Math.floor((Date.now() - (botStats.uptimeStart || Date.now())) / (1000*60*60));
      io.emit('bot-stats', { stats: { guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, commandsToday: botStats.commandsToday, uptimeHours, lastUpdated: botStats.lastUpdated } });
      io.emit('bot-stats-history', { history: botStats.history || [] });
      lastStatsEmitAt = Date.now();
      console.log('Emitted live bot-stats', { guildCount: botStats.guildCount, commandsToday: botStats.commandsToday, uptimeHours });
    }
  }catch(e){ /* non-fatal */ }}catch(e){ console.warn('updateBotStats error', e); } }


// Simple file-backed storage for per-guild plugin state
const PLUGINS_FILE = path.join(__dirname, 'data', 'plugins.json');
const fs = require('fs').promises;
async function loadPluginsFile(){
  try{ const raw = await fs.readFile(PLUGINS_FILE, 'utf8'); return JSON.parse(raw || '{}'); }catch(e){ return {}; }
}
async function savePluginsFile(obj){
  try{ await fs.mkdir(path.dirname(PLUGINS_FILE), { recursive: true }); await fs.writeFile(PLUGINS_FILE, JSON.stringify(obj, null, 2), 'utf8'); }catch(e){ console.warn('Failed to save plugins file', e); }
}
async function notifyBotOfPluginChange(guildId, state){
  if (!BOT_NOTIFY_URL) { console.log('BOT_NOTIFY_URL not set; skipping notify for guild', guildId); return; }
  try{
    const headers = {};
    if (BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = BOT_NOTIFY_SECRET;
    console.log('Notifying bot at', BOT_NOTIFY_URL, 'for guild', guildId, 'secretSet=', !!headers['x-dashboard-secret']);
    const resp = await axios.post(BOT_NOTIFY_URL, { type: 'plugin_update', guildId, state }, { timeout: 5000, headers, validateStatus: () => true });
    if (resp.status >= 200 && resp.status < 300) {
      console.log('Successfully notified bot for', guildId, 'status', resp.status);
      // If bot returned presence snapshot, cache it locally so dashboard can read it even when BOT_PRESENCE_URL is not set
      if (resp.data && resp.data.presences){
        try{
          const pFile = path.join(__dirname, 'data', 'presences.json');
          const existing = await (async ()=>{ try{ const raw = await fs.readFile(pFile, 'utf8'); return JSON.parse(raw || '{}'); }catch(e){ return {}; } })();
          existing[guildId] = resp.data.presences;
          await fs.mkdir(path.dirname(pFile), { recursive: true });
          await fs.writeFile(pFile, JSON.stringify(existing, null, 2));
          console.log('Cached presences for', guildId, 'count', resp.data.presences.length);
        }catch(e){ console.warn('Failed to cache presences', e); }
      }
    } else {
      console.warn('Bot notify returned non-2xx for', guildId, 'status', resp.status, 'body:', resp.data);
    }
  }catch(e){ console.warn('Failed to notify bot of plugin change', e?.message || e); }
}

// File-backed storage for per-guild plugin configuration (welcome/bye messages etc)
const PLUGIN_CONFIG_FILE = path.join(__dirname, 'data', 'plugin-configs.json');
async function loadPluginConfigsFile(){
  try{ const raw = await fs.readFile(PLUGIN_CONFIG_FILE, 'utf8'); return JSON.parse(raw || '{}'); }catch(e){ return {}; }
}
async function savePluginConfigsFile(obj){
  try{ await fs.mkdir(path.dirname(PLUGIN_CONFIG_FILE), { recursive: true }); await fs.writeFile(PLUGIN_CONFIG_FILE, JSON.stringify(obj, null, 2), 'utf8'); }catch(e){ console.warn('Failed to save plugin-configs file', e); }
}

async function notifyBotOfPluginConfigChange(guildId, pluginId, config){
  if (!BOT_NOTIFY_URL) { console.log('BOT_NOTIFY_URL not set; skipping config notify for guild', guildId); return; }
  try{
    const headers = {};
    if (BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = BOT_NOTIFY_SECRET;
    console.log('Notifying bot (config) at', BOT_NOTIFY_URL, 'for guild', guildId, 'plugin', pluginId, 'timeoutMs=', BOT_NOTIFY_TIMEOUT_MS, 'retries=', BOT_NOTIFY_RETRIES);
    let lastErr = null;
    for (let attempt=0; attempt<=BOT_NOTIFY_RETRIES; attempt++){
      try{
        const resp = await axios.post(BOT_NOTIFY_URL, { type: 'plugin_config', guildId, pluginId, config }, { timeout: BOT_NOTIFY_TIMEOUT_MS, headers, validateStatus: () => true });
        if (resp.status >= 200 && resp.status < 300) {
          console.log('Successfully notified bot (config) for', guildId, 'status', resp.status);
          // if bot returned presences, cache them
          if (resp.data && resp.data.presences){
            try{
              const pFile = path.join(__dirname, 'data', 'presences.json');
              const existing = await (async ()=>{ try{ const raw = await fs.readFile(pFile, 'utf8'); return JSON.parse(raw || '{}'); }catch(e){ return {}; } })();
              existing[guildId] = resp.data.presences;
              await fs.mkdir(path.dirname(pFile), { recursive: true });
              await fs.writeFile(pFile, JSON.stringify(existing, null, 2));
              console.log('Cached presences for', guildId, 'count', resp.data.presences.length);
            }catch(e){ console.warn('Failed to cache presences', e); }
          }
          return;
        }
        console.warn('Bot config notify returned non-2xx for', guildId, 'status', resp.status, 'body:', resp.data);
        return;
      }catch(err){ lastErr = err; console.warn('Failed to notify bot of config change attempt', attempt+1, 'of', BOT_NOTIFY_RETRIES+1, err?.message || err); if (attempt < BOT_NOTIFY_RETRIES){ const backoff = 500 * Math.pow(2, attempt); await new Promise(r=>setTimeout(r, backoff)); } }
    }
    console.warn('Failed to notify bot of plugin config change after retries', lastErr?.message || lastErr);
  }catch(e){ console.warn('Failed to notify bot of plugin config change', e?.message || e); }
}

// Expose plugin config for web UI: GET (requires auth)
app.get('/api/server-plugin-config/:guildId', async (req, res) => {
  const token = req.cookies?.ng_token; if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const guildId = req.params.guildId;
  const all = await loadPluginConfigsFile();
  return res.json({ guildId, config: all[guildId] || {} });
});

// Notify bot to perform a test (e.g., send a sample welcome/bye message)
async function notifyBotOfPluginTest(guildId, pluginId, payload){
  if (!BOT_NOTIFY_URL) { console.log('BOT_NOTIFY_URL not set; skipping test notify for guild', guildId); return; }
  try{
    const headers = {};
    if (BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = BOT_NOTIFY_SECRET;
    console.log('Notifying bot (test) at', BOT_NOTIFY_URL, 'for guild', guildId, 'plugin', pluginId, 'timeoutMs=', BOT_NOTIFY_TIMEOUT_MS, 'retries=', BOT_NOTIFY_RETRIES);
    let lastErr = null;
    for (let attempt=0; attempt<=BOT_NOTIFY_RETRIES; attempt++){
      try{
        const resp = await axios.post(BOT_NOTIFY_URL, { type: 'plugin_test', guildId, pluginId, payload }, { timeout: BOT_NOTIFY_TIMEOUT_MS, headers, validateStatus: () => true });
        if (resp.status >= 200 && resp.status < 300) { console.log('Successfully notified bot (test) for', guildId, 'status', resp.status); return resp.data; }
        console.warn('Bot test notify returned non-2xx for', guildId, 'status', resp.status, 'body:', resp.data);
        return resp.data;
      }catch(err){ lastErr = err; console.warn('Failed to notify bot of plugin test attempt', attempt+1, 'of', BOT_NOTIFY_RETRIES+1, err?.message || err); if (attempt < BOT_NOTIFY_RETRIES){ const backoff = 500 * Math.pow(2, attempt); await new Promise(r=>setTimeout(r, backoff)); } }
    }
    console.warn('Failed to notify bot of plugin test after retries', lastErr?.message || lastErr);
    return null;
  }catch(e){ console.warn('Failed to notify bot of plugin test', e?.message || e); return null; }
}

async function notifyBotOfGiveawayAction(guildId, action, payload, opts){
  opts = opts || {};
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : BOT_NOTIFY_TIMEOUT_MS;
  const retries = typeof opts.retries === 'number' ? opts.retries : BOT_NOTIFY_RETRIES;
  if (!BOT_NOTIFY_URL) { console.log('BOT_NOTIFY_URL not set; skipping giveaway action notify for guild', guildId); return { ok: false, error: 'BOT_NOTIFY_URL not set' }; }
  try{
    const headers = {};
    if (BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = BOT_NOTIFY_SECRET;
    console.log('Notifying bot (giveaway_action) at', BOT_NOTIFY_URL, 'for guild', guildId, 'action', action, 'timeoutMs=', timeoutMs, 'retries=', retries);

    // Attempt with retries (per-call)
    let lastErr = null;
    for (let attempt=0; attempt<=retries; attempt++){
      try{
        const resp = await axios.post(BOT_NOTIFY_URL, { type: 'giveaway_action', guildId, action, payload }, { timeout: timeoutMs, headers, validateStatus: () => true });
        if (resp.status >= 200 && resp.status < 300) {
          console.log('Successfully notified bot (giveaway_action) for', guildId, 'action', action, 'status', resp.status, 'bodyKeys=', resp.data && typeof resp.data === 'object' ? Object.keys(resp.data) : typeof resp.data);
          return { ok: true, data: resp.data, status: resp.status };
        }
        console.warn('Bot giveaway_action notify returned non-2xx for', guildId, 'status', resp.status, 'body:', resp.data);
        return { ok: false, error: 'non-2xx', status: resp.status, data: resp.data };
      }catch(err){
        lastErr = err;
        console.warn('Failed to notify bot of giveaway_action attempt', attempt+1, 'of', retries+1, 'err:', err?.message || err, 'code:', err?.code, 'status:', err?.response?.status, 'dataKeys:', err?.response && typeof err.response.data === 'object' ? Object.keys(err.response.data) : typeof err.response?.data);
        if (attempt < retries){ const backoff = 500 * Math.pow(2, attempt); await new Promise(r=>setTimeout(r, backoff)); }
      }
    }

    // If bot is hosted locally and we failed, provide an extra-helpful suggestion
    const out = { ok: false, error: lastErr?.message || String(lastErr), code: lastErr?.code, status: lastErr?.response?.status, data: lastErr?.response?.data };
    try{ if (BOT_NOTIFY_URL && (BOT_NOTIFY_URL.includes('localhost') || BOT_NOTIFY_URL.includes('127.0.0.1'))){ out.suggestion = 'It looks like your bot webhook points to localhost. Ensure the bot process is running and listening on the configured port (and is reachable from this server).'; } }catch(e){}
    return out;
  }catch(e){ console.warn('Failed to notify bot of giveaway_action', e?.message || e); return { ok: false, error: e?.message || String(e) }; }
}

// Ask the bot to recompute authoritative counts from its cache (protected endpoint on bot)
async function requestBotRecomputeStats(){
  if (!BOT_NOTIFY_URL) return null;
  try{
    const headers = {};
    if (BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = BOT_NOTIFY_SECRET;
    // Derive base URL from BOT_NOTIFY_URL (strip trailing /webhook if present)
    const base = BOT_NOTIFY_URL.replace(/\/webhook\/?$/i, '').replace(/\/$/, '');
    const url = base + '/internal/recompute-stats';
    const resp = await axios.post(url, {}, { timeout: 8000, headers, validateStatus: () => true });
    if (resp && resp.status >= 200 && resp.status < 300 && resp.data && resp.data.stats) return resp.data.stats;
    if (resp && resp.status >= 200 && resp.status < 300 && resp.data && (typeof resp.data.guildCount === 'number' || typeof resp.data.totalMembers === 'number')) return resp.data;
    console.warn('requestBotRecomputeStats: non-2xx or unexpected body', resp && resp.status, resp && resp.data);
    return null;
  }catch(e){ console.warn('requestBotRecomputeStats failed', e?.message || e); return null; }
}

// POST test endpoint (triggers the bot to send a test welcome/bye)
app.post('/api/server-plugin-test/:guildId', async (req, res) => {
  const token = req.cookies?.ng_token; if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const guildId = req.params.guildId; const body = req.body || {};
  const pluginId = body.pluginId || 'welcome';
  const testType = body.testType || 'welcome';
  // accept optional config or payload to forward to bot for more accurate testing
  const payload = { testType, userId: body.userId || null, config: body.config || body.payload || null };

  // record activity
  try{
    const userJson = req.cookies?.ng_user || null;
    let user = null;
    try{ user = userJson ? JSON.parse(userJson) : null; }catch(e){}
    const entry = { guildId, type: 'plugin_test', pluginId, payload, user: (user ? { id: user.id, username: user.username+'#'+user.discriminator } : null), ts: Date.now() };
    await appendActivity(entry);
  }catch(e){ console.warn('Failed to record plugin test activity', e); }

  const result = await notifyBotOfPluginTest(guildId, pluginId, payload);
  return res.json({ ok: true, result });
});

// POST plugin config (persist and notify the bot)
app.post('/api/server-plugin-config/:guildId', async (req, res) => {
  const token = req.cookies?.ng_token; if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const guildId = req.params.guildId; const body = req.body || {};
  const all = await loadPluginConfigsFile();
  const prev = all[guildId] || {};
  const current = { ...prev };

  if (body.pluginId && typeof body.config === 'object'){
    current[body.pluginId] = body.config;
  }else if (typeof body.config === 'object'){
    // merge full config
    Object.assign(current, body.config);
  }else if (typeof body === 'object'){
    Object.assign(current, body);
  }

  all[guildId] = current;
  await savePluginConfigsFile(all);
  console.log('Saved plugin config for guild', guildId, Object.keys(current));

  // record activity entry
  try{
    const userJson = req.cookies?.ng_user || null;
    let user = null;
    try{ user = userJson ? JSON.parse(userJson) : null; }catch(e){}
    const entry = { guildId, type: 'plugin_config_update', pluginId: body.pluginId || null, config: (body.pluginId ? { [body.pluginId]: body.config } : body.config || body), user: (user ? { id: user.id, username: user.username+'#'+user.discriminator } : null), ts: Date.now() };
    await appendActivity(entry);
  }catch(e){ console.warn('Failed to record config activity', e); }

  // Notify the bot
  try{
    await notifyBotOfPluginConfigChange(guildId, (body.pluginId || null), (body.pluginId ? body.config : body.config || body));
  }catch(e){ console.warn('notifyBotOfPluginConfigChange error', e?.message || e); }

  return res.json({ ok: true, config: all[guildId] });
});

// Get list of giveaways for a guild (proxied to bot)
app.get('/api/server-giveaways/:guildId', async (req, res) => {
  const guildId = req.params.guildId;
  try{
    // Use a short timeout for 'list' to avoid blocking the UI when the bot is slow/unavailable
    const resp = await notifyBotOfGiveawayAction(guildId, 'list', {}, { timeoutMs: Number(process.env.BOT_LIST_TIMEOUT_MS || 3000), retries: Number(process.env.BOT_LIST_RETRIES || 0) });
    console.log('server-giveaways: bot response for', guildId, resp && resp.ok ? (Array.isArray(resp.data && resp.data.giveaways) ? `giveaways=${resp.data.giveaways.length}` : 'no giveaways') : ('failed: ' + (resp && (resp.error || resp.message) || 'no body')));
    if (resp && resp.ok && Array.isArray(resp.data.giveaways) && resp.data.giveaways.length) {
      // Normalize giveaway objects so the dashboard has consistent fields it expects
      const norm = (g) => {
        try{
          const out = Object.assign({}, g);
          // normalize createdAt: accept createdAt, createdAtISO, ts
          if (!out.createdAt){ if (out.createdAtISO) out.createdAt = out.createdAtISO; else if (out.ts) out.createdAt = (typeof out.ts === 'number') ? new Date(out.ts).toISOString() : out.ts; }
          // normalize endsAt: prefer ISO strings, then numeric seconds (endAt), then milliseconds
          if (!out.endsAt){ if (out.ends_at) out.endsAt = out.ends_at; else if (out.endAt) {
            // endAt may be epoch seconds
            if (typeof out.endAt === 'number' && out.endAt > 1e10) { out.endsAt = new Date(out.endAt).toISOString(); }
            else if (typeof out.endAt === 'number') { out.endsAt = new Date(out.endAt * 1000).toISOString(); }
            else out.endsAt = out.endAt;
          } else if (out.endTimestampMs){ out.endsAt = new Date(Number(out.endTimestampMs)).toISOString(); } else if (out.endTimestamp){ out.endsAt = new Date(Number(out.endTimestamp)).toISOString(); } }
          // friendly creator name: prefer creatorName or createdBy or resolve hostId
          if (!out.creatorName){ if (out.createdBy) out.creatorName = out.createdBy; else if (out.creator && out.creator.username) out.creatorName = out.creator.username; else if (out.hostId) out.creatorName = out.hostId; }
          // ensure prize exists
          out.prize = out.prize || (out.payload && out.payload.prize) || '(no prize)';
          return out;
        }catch(e){ return g; }
      };
      const normalized = resp.data.giveaways.map(norm);
      // Sort by newest createdAt (fallback to endsAt) so latest giveaways appear first in UI
      normalized.sort((a,b) => {
        const aTs = Date.parse(a.createdAt || a.endsAt || '') || 0;
        const bTs = Date.parse(b.createdAt || b.endsAt || '') || 0;
        return bTs - aTs;
      });
      return res.json({ ok: true, giveaways: normalized });
    }

    // Fallback: synthesize giveaways from recent plugin_test activity entries
    try{
      const allActivity = await loadActivityFile();
      const tests = allActivity.filter(x => x.guildId === guildId && x.type === 'plugin_test' && x.pluginId && String(x.pluginId).toLowerCase().includes('giveaway'));
      if (tests && tests.length){
        // map to ephemeral giveaways
        let giveaways = tests.map(t => {
          const payload = t.payload || {};
          const cfg = payload.config && payload.config.giveaway ? payload.config.giveaway : (payload.config || payload.giveaway || {});
          const duration = (cfg && cfg.duration) ? Number(cfg.duration) : (cfg && cfg.durationMinutes ? Number(cfg.durationMinutes) : 1);
          const prize = (cfg && cfg.prize) ? cfg.prize : (payload && payload.prize) || 'Test prize';
          const createdAt = new Date(t.ts || Date.now());
          const endsAt = duration ? new Date(createdAt.getTime() + (Number(duration) || 1) * 60 * 1000) : null;
          return { id: `test-${t.ts || Date.now()}`, giveawayId: `test-${t.ts || Date.now()}`, prize, createdAt: createdAt.toISOString(), endsAt: endsAt ? endsAt.toISOString() : null, createdBy: (t.user && t.user.username) || 'System', channel: { id: (cfg && cfg.channel) || (payload && payload.channelId) || null } };
        });
        // sort synthesized items newest-first by createdAt and return the most recent 10
        giveaways.sort((a,b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
        giveaways = giveaways.slice(0, 10);
        console.log('server-giveaways: returning', giveaways.length, 'synthesized giveaways from activity for', guildId);
        return res.json({ ok: true, giveaways });
      }
    }catch(e){ console.warn('Failed to synthesize giveaways from activity', e); }

    // No giveaways found
    return res.json({ ok: true, giveaways: [] });
  }catch(e){ console.warn('Failed to fetch giveaways', e); return res.status(500).json({ error: 'Failed to fetch giveaways' }); }
});

// Reroll a giveaway via bot
app.post('/api/server-giveaway-reroll/:guildId', async (req, res) => {
  const token = req.cookies?.ng_token; if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const guildId = req.params.guildId; const body = req.body || {};
  const giveawayId = body.giveawayId;
  if (!giveawayId) return res.status(400).json({ error: 'Missing giveawayId' });

  // record reroll request in activity log
  try{
    const userJson = req.cookies?.ng_user || null;
    let user = null;
    try{ user = userJson ? JSON.parse(userJson) : null; }catch(e){}
    const entry = { guildId, type: 'giveaway_reroll_requested', payload: { giveawayId }, user: (user ? { id: user.id, username: user.username+'#'+user.discriminator } : null), ts: Date.now() };
    await appendActivity(entry);
  }catch(e){ console.warn('Failed to record reroll activity', e); }

  try{
    // For rerolls, allow a longer timeout but fewer retries by default (bot may need time)
    const rerollTimeout = Number(process.env.BOT_NOTIFY_REROLL_TIMEOUT_MS || 60000);
    const rerollRetries = Number(process.env.BOT_NOTIFY_REROLL_RETRIES || 1);
    const result = await notifyBotOfGiveawayAction(guildId, 'reroll', { giveawayId }, { timeoutMs: rerollTimeout, retries: rerollRetries });

    if (!result || !result.ok) {
      console.warn('Reroll: bot failed or no response for', guildId, 'giveaway', giveawayId, 'details:', result);
      // Provide more actionable information for the client
      const details = Object.assign({}, result || {});
      if (details && details.code === 'ECONNABORTED') details.suggestion = 'Timeout contacting bot. Check BOT_NOTIFY_URL or whether the bot is reachable.';
      return res.status(502).json({ ok: false, error: 'bot_failure', details });
    }
    // success; optionally record bot response as activity
    try{
      const entry = { guildId, type: 'giveaway_reroll_result', payload: { giveawayId, botResult: result.data }, ts: Date.now() };
      await appendActivity(entry);
    }catch(e){ console.warn('Failed to record reroll result activity', e); }
    return res.json({ ok: true, result: result.data });
  }catch(e){ console.warn('Failed to reroll giveaway', e); return res.status(500).json({ error: 'Failed to reroll giveaway', details: (e && e.message) || String(e) }); }
});

// Resolve winners for a giveaway (returns resolved member info when available)
app.get('/api/giveaway-winners-resolve/:guildId/:giveawayId', async (req, res) => {
  const { guildId, giveawayId } = req.params;
  try{
    // Try to ask bot for giveaways first (fast path)
    let winners = [];
    try{
      const resp = await notifyBotOfGiveawayAction(guildId, 'list', {}, { timeoutMs: Number(process.env.BOT_LIST_TIMEOUT_MS || 3000), retries: Number(process.env.BOT_LIST_RETRIES || 0) });
      if (resp && resp.ok && Array.isArray(resp.data.giveaways)){
        const g = resp.data.giveaways.find(x => String(x.id) === String(giveawayId) || String(x.giveawayId) === String(giveawayId));
        if (g){ const w = g.winners || g.winner || []; winners = Array.isArray(w) ? w : [w]; }
      }
    }catch(e){ /* non-fatal */ }

    // Fallback to local giveaways file
    if (!winners || winners.length === 0){
      try{
        const gf = path.join(__dirname, 'data', 'giveaways.json');
        const raw = await fs.readFile(gf, 'utf8').catch(()=>null);
        const arr = raw ? JSON.parse(raw) : [];
        const g = (arr||[]).find(x => String(x.id) === String(giveawayId) || String(x.giveawayId) === String(giveawayId));
        if (g){ const w = g.winners || g.winner || []; winners = Array.isArray(w) ? w : (w ? [w] : []); }
      }catch(e){ /* ignore */ }
    }

    // Normalize to ID strings
    const ids = (winners||[]).map(w => (typeof w === 'object' && w && w.id) ? String(w.id) : String(w)).filter(Boolean);

    // Resolve each id via Discord API (if BOT_TOKEN) or proxy to bot presence URL when available
    const resolved = await Promise.all(ids.map(async (id) => {
      try{
        if (BOT_TOKEN){
          const r = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(id)}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
          if (r && r.status === 200){ const user = (r.data && r.data.user) || {}; return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar }; }
          if (r && r.status === 404) return { id, unresolved: true };
          return { id, unresolved: true, error: r && r.status };
        }

        const presenceBase = process.env.BOT_PRESENCE_URL;
        const headers = {};
        if (BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = BOT_NOTIFY_SECRET;
        if (presenceBase){
          const r = await axios.get(`${presenceBase.replace(/\/$/, '')}/guild-member/${encodeURIComponent(guildId)}/${encodeURIComponent(id)}`, { headers, timeout: 4000, validateStatus: () => true });
          if (r && r.status >= 200 && r.status < 300 && r.data && r.data.member) return { id: r.data.member.id, username: r.data.member.username, discriminator: r.data.member.discriminator, avatar: r.data.member.avatar };
          if (r && r.status === 404) return { id, unresolved: true };
          return { id, unresolved: true, error: r && r.status };
        }

        // nothing available to resolve
        return { id, unresolved: true };
      }catch(e){ return { id, unresolved: true, error: (e && e.message) ? e.message : String(e) }; }
    }));

    return res.json({ ok: true, winners: ids, resolved });
  }catch(e){ console.warn('Failed to resolve giveaway winners', e); return res.status(500).json({ error: 'Failed to resolve giveaway winners' }); }
});


// Health-check for bot webhook (convenience endpoint)
app.get('/api/bot-webhook-health', async (req, res) => {
  if (!BOT_NOTIFY_URL) return res.status(400).json({ ok:false, error: 'BOT_NOTIFY_URL not set' });
  try{
    const headers = {};
    if (BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = BOT_NOTIFY_SECRET;
    const resp = await axios.post(BOT_NOTIFY_URL, { type: 'ping' }, { timeout: BOT_NOTIFY_TIMEOUT_MS, headers, validateStatus: () => true });
    return res.json({ ok: true, status: resp.status, body: resp.data });
  }catch(err){
    console.warn('Bot webhook health check failed', err?.message || err, 'code:', err?.code, 'status:', err?.response?.status);
    const out = { ok:false, error: err?.message || 'failed', code: err?.code, status: err?.response?.status, data: err?.response?.data };
    if (BOT_NOTIFY_URL && (BOT_NOTIFY_URL.includes('localhost') || BOT_NOTIFY_URL.includes('127.0.0.1'))){ out.suggestion = 'BOT_NOTIFY_URL points to localhost; ensure the bot is running and reachable from this server (check ports and firewall).'; }
    return res.status(502).json(out);
  }
});

// Inbound bot event webhook — bots can notify dashboard of guild join/leave events to keep caches fresh
app.post('/bot-event', (req, res) => {
  const secret = req.header('x-dashboard-secret') || '';
  const remote = (req.ip || (req.connection && req.connection.remoteAddress) || '').replace('::ffff:', '');
  const body = req.body || {};
  const type = body.type;
  const guildId = body.guildId || body.guild_id || body.guild;
  console.log('Bot event incoming', { type, guildId, from: remote, secretProvided: !!secret });
  // record a diagnostic snapshot
  lastBotEvent = { type, guildId, from: remote, at: Date.now() };
  const allowedSecrets = [];
  if (BOT_NOTIFY_SECRET) allowedSecrets.push(BOT_NOTIFY_SECRET);
  if (process.env.WEBHOOK_SECRET) allowedSecrets.push(process.env.WEBHOOK_SECRET);
  const isLocal = remote === '127.0.0.1' || remote === '::1';
  // Allow events when a valid secret is provided OR when the request originates from localhost (convenience for local dev)
  if (!((allowedSecrets.length > 0 && allowedSecrets.includes(secret)) || (secret === '' && isLocal))) return res.status(403).json({ error: 'Forbidden' });
  // Allow stats_update events without a guildId (they are aggregate updates coming from the bot)
  if (!type || (type !== 'stats_update' && type !== 'stats' && !guildId)) return res.status(400).json({ error: 'Missing type or guildId' });

  console.log('Bot event received', type, guildId);
  // Standardize event types
  if (type === 'guild_left' || type === 'guild_deleted' || type === 'left'){
    try{
      // mark presence false and update caches
      botPresenceCache.set(guildId, { present: false, expiresAt: Date.now() + BOT_PRESENCE_TTL_MS });
      let foundMemberCount = null;
      for (const [key, val] of guildsCache.entries()){
        if (val && Array.isArray(val.guilds)){
          let changed = false;
          for (const g of val.guilds){
            if (g && String(g.id) === String(guildId)) {
              g.bot_present = false; changed = true;
              if (typeof g.memberCount === 'number') foundMemberCount = g.memberCount;
            }
          }
          if (changed){ guildsCache.set(key, { guilds: val.guilds, expiresAt: val.expiresAt }); }
        }
      }
      addRecentGuildEvent({ type: 'guild_left', guildId });

      // Adjust overall stats: decrement guild count and subtract member count when known
      try{
        if (typeof botStats.guildCount === 'number' && botStats.guildCount > 0){ botStats.guildCount = Math.max(0, botStats.guildCount - 1); }
        if (foundMemberCount !== null && typeof botStats.totalMembers === 'number'){ botStats.totalMembers = Math.max(0, botStats.totalMembers - Number(foundMemberCount)); }
        botStats.lastUpdated = Date.now();
        saveBotStatsFile().catch(()=>{});
        // Emit live update so UI reflects change immediately
        try{ if (io){ const uptimeHours = Math.floor((Date.now() - (botStats.uptimeStart || Date.now()))/(1000*60*60)); io.emit('bot-stats', { stats: { guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, commandsToday: botStats.commandsToday, uptimeHours, lastUpdated: botStats.lastUpdated } }); io.emit('bot-stats-history', { history: botStats.history || [] }); lastStatsEmitAt = Date.now(); console.log('Emitted live bot-stats (guild_left)', { guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, uptimeHours }); } }catch(e){}

        // If we didn't have a member count available, ask the bot to recompute authoritative totals
        if (foundMemberCount === null) {
          (async ()=>{
            try{
              const stats = await requestBotRecomputeStats();
              if (stats && typeof stats.guildCount === 'number'){
                botStats.guildCount = stats.guildCount;
                if (typeof stats.totalMembers === 'number') botStats.totalMembers = stats.totalMembers;
                botStats.lastUpdated = Date.now();
                saveBotStatsFile().catch(()=>{});
                try{ if (io){ const uptimeHours = Math.floor((Date.now() - (botStats.uptimeStart || Date.now()))/(1000*60*60)); io.emit('bot-stats', { stats: { guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, commandsToday: botStats.commandsToday, uptimeHours, lastUpdated: botStats.lastUpdated } }); io.emit('bot-stats-history', { history: botStats.history || [] }); lastStatsEmitAt = Date.now(); console.log('Emitted live bot-stats (recompute after guild_left)', { guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, uptimeHours }); } }catch(e){}
              }
            }catch(e){ console.warn('Recompute after guild_left failed', e); }
          })();
        }
      }catch(e){ console.warn('Failed to adjust stats for guild_left', e); }

    }catch(e){ console.warn('Error processing guild_left event', e); }
    return res.json({ ok: true });
  }

  if (type === 'guild_joined' || type === 'joined'){
    try{
      botPresenceCache.set(guildId, { present: true, expiresAt: Date.now() + BOT_PRESENCE_TTL_MS });
      // prefer memberCount from the event payload when available
      let memberCountFromPayload = null;
      if (typeof body.memberCount === 'number') memberCountFromPayload = Number(body.memberCount);
      if (typeof body.member_count === 'number') memberCountFromPayload = Number(body.member_count);
      if (typeof body.members === 'number') memberCountFromPayload = Number(body.members);

      for (const [key, val] of guildsCache.entries()){
        if (val && Array.isArray(val.guilds)){
          let changed = false;
          for (const g of val.guilds){
            if (g && String(g.id) === String(guildId)) {
              g.bot_present = true; changed = true;
              if (memberCountFromPayload === null && typeof g.memberCount === 'number') memberCountFromPayload = g.memberCount;
            }
          }
          if (changed){ guildsCache.set(key, { guilds: val.guilds, expiresAt: val.expiresAt }); }
        }
      }
      addRecentGuildEvent({ type: 'guild_joined', guildId });
      // Increment guildCount and add memberCount if we know it
      try{
        botStats.guildCount = (typeof botStats.guildCount === 'number') ? (botStats.guildCount + 1) : 1;
        if (memberCountFromPayload !== null && typeof botStats.totalMembers === 'number'){
          botStats.totalMembers = Number(botStats.totalMembers) + Number(memberCountFromPayload);
        }
        botStats.lastUpdated = Date.now(); saveBotStatsFile().catch(()=>{});
        // Emit live update so UI reflects change immediately
        try{ if (io){ const uptimeHours = Math.floor((Date.now() - (botStats.uptimeStart || Date.now()))/(1000*60*60)); io.emit('bot-stats', { stats: { guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, commandsToday: botStats.commandsToday, uptimeHours, lastUpdated: botStats.lastUpdated } }); io.emit('bot-stats-history', { history: botStats.history || [] }); lastStatsEmitAt = Date.now(); console.log('Emitted live bot-stats (guild_joined)', { guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, uptimeHours }); } }catch(e){}

        // If the join event didn't include memberCount, ask the bot to recompute authoritative totals
        if (memberCountFromPayload === null){
          (async ()=>{
            try{
              const stats = await requestBotRecomputeStats();
              if (stats && typeof stats.guildCount === 'number'){
                botStats.guildCount = stats.guildCount;
                if (typeof stats.totalMembers === 'number') botStats.totalMembers = stats.totalMembers;
                botStats.lastUpdated = Date.now(); saveBotStatsFile().catch(()=>{});
                try{ if (io){ const uptimeHours = Math.floor((Date.now() - (botStats.uptimeStart || Date.now()))/(1000*60*60)); io.emit('bot-stats', { stats: { guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, commandsToday: botStats.commandsToday, uptimeHours, lastUpdated: botStats.lastUpdated } }); io.emit('bot-stats-history', { history: botStats.history || [] }); lastStatsEmitAt = Date.now(); console.log('Emitted live bot-stats (recompute after guild_joined)', { guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, uptimeHours }); } }catch(e){}
              }
            }catch(e){ console.warn('Recompute after guild_joined failed', e); }
          })();
        }
      }catch(e){ console.warn('Failed to update stats on guild_joined', e); }
    }catch(e){ console.warn('Error processing guild_joined event', e); }
    return res.json({ ok: true });
  }

  // Accept stats update messages from the bot
  if (type === 'stats_update' || type === 'stats'){
    try{
      const stats = body.stats || body.data || {};
      updateBotStats(stats);
      // If the bot sends a 'totalMembers' estimate, we update and persist
      if (typeof stats.totalMembers === 'number') { botStats.totalMembers = stats.totalMembers; saveBotStatsFile().catch(()=>{}); }
      // also emit history update for clients
      try{ if (io) io.emit('bot-stats-history', { history: botStats.history || [] }); }catch(e){}
      return res.json({ ok: true, stats: botStats });
    }catch(e){ console.warn('Error processing stats update', e); return res.status(500).json({ error: 'Failed to process stats update' }); }
  }

  // Unknown event type
  return res.status(400).json({ error: 'Unknown type' });
});

// Allow clients to poll recent guild events (used by dashboard to detect leaves/joins quickly)
app.get('/api/recent-guild-events', (req, res) => {
  const cutoff = Date.now() - (10*60*1000); // 10 minutes
  const recent = recentGuildEvents.filter(e => e.at >= cutoff);
  return res.json({ events: recent });
});

// Public stats endpoint for landing page preview
app.get('/api/stats', (req, res) => {
  try{
    // If stats are empty and we have no data, return demo values for the public landing preview
    const isEmpty = (!botStats.guildCount && !botStats.totalMembers && !botStats.commandsToday);
    const uptimeMs = Date.now() - (botStats.uptimeStart || Date.now());
    const uptimeHours = Math.floor(uptimeMs / (1000*60*60));
    if (isEmpty && (!botStats.lastUpdated || (Date.now() - botStats.lastUpdated) > (24*60*60*1000))){
      // Demo (non-persistent) values
      return res.json({ guildCount: 1234, totalMembers: 98432, commandsToday: 3200, uptimeHours, lastUpdated: Date.now() });
    }
    return res.json({ guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, commandsToday: botStats.commandsToday, uptimeHours, lastUpdated: botStats.lastUpdated });
  }catch(e){ return res.status(500).json({ error: 'Failed to get stats' }); }
});

// Return a compact history suitable for a sparkline (array of numbers)
app.get('/api/stats-history', (req, res) => {
  try{
    const hist = (botStats.history || []).map(s => ({ t: s.t, v: s.v }));
    // If we have no stored history, try to return a useful synthetic series:
    // - If there's no real stats at all, provide a demo randomized history
    // - If stats exist but history is empty, provide a flat series based on current commandsToday
    if (!hist || hist.length === 0){
      const now = Date.now();
      if (!botStats.guildCount && !botStats.totalMembers && !botStats.commandsToday){
        // Demo (non-persistent) series to make the sparkline look interesting
        const demo = [];
        for (let i=11;i>=0;i--){ demo.push({ t: now - i*3600*1000, v: Math.round(2000 + Math.random()*1400) }); }
        return res.json({ history: demo });
      }
      // Use a flat recent history derived from current commandsToday so the sparkline shows a baseline
      const flat = [];
      const base = Number(botStats.commandsToday) || 0;
      for (let i=11;i>=0;i--){ flat.push({ t: now - i*3600*1000, v: base }); }
      return res.json({ history: flat });
    }

    return res.json({ history: hist });
  }catch(e){ return res.status(500).json({ error: 'Failed to fetch stats history' }); }
});

// Internal endpoint for bots/tools to fetch config directly (authenticated by header)
app.get('/internal/server-plugin-config/:guildId', async (req, res) => {
  const secret = req.header('x-dashboard-secret') || '';
  if (!BOT_NOTIFY_SECRET || secret !== BOT_NOTIFY_SECRET) return res.status(403).json({ error: 'Forbidden' });
  const guildId = req.params.guildId;
  const all = await loadPluginConfigsFile();
  return res.json({ guildId, config: all[guildId] || {} });
});

function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

// Return guilds for the authenticated user using the stored token
app.get('/api/guilds', async (req, res) => {
  const token = req.cookies?.ng_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  // Use token as a cache key (tokens are short-lived but fine for local dev)
  const cacheKey = token;
  const cached = guildsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ guilds: cached.guilds, cached: true });
  }

  // Attempt to fetch with retry on 429
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const guildsResp = await axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
      const guilds = guildsResp.data;
      console.log(`Fetched ${Array.isArray(guilds) ? guilds.length : 0} guilds for user`);

      // If we have a bot token and id configured, check whether the bot is present in each guild
      if (BOT_TOKEN && BOT_ID && Array.isArray(guilds) && guilds.length > 0) {
        for (const g of guilds) {
          try {
            const cachedPresence = botPresenceCache.get(g.id);
            if (cachedPresence && cachedPresence.expiresAt > Date.now()) {
              g.bot_present = cachedPresence.present;
              continue;
            }

            // Query the guild member endpoint for the bot user; 200 means present, 404 means not present
            const memberResp = await axios.get(`https://discord.com/api/guilds/${g.id}/members/${BOT_ID}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
            const present = memberResp.status === 200;
            botPresenceCache.set(g.id, { present, expiresAt: Date.now() + BOT_PRESENCE_TTL_MS });
            g.bot_present = present;
          } catch (err) {
            console.warn('Error checking bot presence for guild', g.id, err?.message || err);
            g.bot_present = false;
          }
        }
      }

      // Cache guilds and return
      guildsCache.set(cacheKey, { guilds, expiresAt: Date.now() + CACHE_TTL_MS });
      return res.json({ guilds });
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      // Rate limit handling
      if (status === 429) {
        const retryAfter = (data && data.retry_after) ? Number(data.retry_after) : (err.response?.headers?.['retry-after'] ? Number(err.response.headers['retry-after']) : 1);
        const waitMs = Math.ceil(retryAfter * 1000) + 250; // small buffer
        console.warn(`Discord rate limited this request. Retry after ${retryAfter}s (attempt ${attempt}/${maxRetries})`);
        await sleep(waitMs);
        continue; // retry
      }
      console.error('Failed to fetch guilds', data || err.message || err);
      return res.status(500).json({ error: 'Failed to fetch guilds', details: data || err.message });
    }
  }

  // If we've exhausted retries
  console.error('Exhausted retries for fetching guilds due to rate limiting');
  return res.status(429).json({ error: 'Rate limited, try again later' });
});

// Debug endpoint to return cached guilds (development only)
app.get('/debug/guilds', (req, res) => {
  const token = req.cookies?.ng_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const cached = guildsCache.get(token);
  if (!cached) return res.status(404).json({ error: 'No cached guilds found (call /api/guilds first)' });
  return res.json({ cached: true, count: cached.guilds.length, sample: cached.guilds.slice(0,5) });
});

// Fetch members for a guild using bot token (limited list)
// Targeted guild metadata endpoint (returns name, icon, and bot presence)
app.get('/api/guild/:guildId', async (req, res) => {
  const guildId = req.params.guildId;
  if (!guildId) return res.status(400).json({ error: 'missing guild id' });
  try{
    if (BOT_TOKEN){
      const r = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
      if (r && r.status === 200 && r.data){
        const guild = { id: r.data.id, name: r.data.name, icon: r.data.icon };
        // Check bot presence too (best-effort)
        try{
          const m = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members/${BOT_ID}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
          guild.bot_present = (m.status === 200);
          try{ botPresenceCache.set(guildId, { present: guild.bot_present, expiresAt: Date.now() + BOT_PRESENCE_TTL_MS }); }catch(e){}
        }catch(e){ guild.bot_present = false; }
        return res.json(guild);
      }
    }
  }catch(e){ console.warn('/api/guild/:id fetch failed', e?.message || e); }
  return res.status(404).json({ error: 'not found' });
});

app.get('/api/guild-members/:guildId', async (req, res) => {
  const guildId = req.params.guildId;
  console.log('Request: /api/guild-members for', guildId);
  const limit = Math.min(50, parseInt(req.query.limit || '25', 10));
  if (!BOT_TOKEN){
    // fall back to bot presence endpoint if configured
    const presenceBase = process.env.BOT_PRESENCE_URL;
    const headers = {};
    if (BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = BOT_NOTIFY_SECRET;
    if (presenceBase){
      try{
        const r = await axios.get(`${presenceBase.replace(/\/$/, '')}/guild-members/${encodeURIComponent(guildId)}?limit=${limit}`, { headers, timeout: 5000, validateStatus: () => true });
        if (r && r.status >= 200 && r.status < 300){ return res.json(r.data); }
        console.warn('Presence proxy returned non-2xx', r.status, r.data);
        return res.status(r.status || 500).json({ error: 'Failed to fetch members from bot', details: r.data });
      }catch(e){ console.warn('Failed to proxy to bot presence for guild-members', e && e.message ? e.message : e); return res.status(500).json({ error: 'Failed to fetch members from bot' }); }
    }
    console.warn('BOT_TOKEN missing, cannot fetch guild members'); return res.status(501).json({ error: 'Bot token not configured on server' });
  }
  try{
    // limit to 25 members for display
    const membersResp = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members?limit=${limit}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 8000, validateStatus: () => true });
    console.log('/api/guild-members -> discord response status', membersResp.status);
    if (membersResp.status === 200){
      // normalize to simple objects
      const members = (membersResp.data || []).map(m => ({ id: m.user?.id, username: m.user?.username, discriminator: m.user?.discriminator, avatar: m.user?.avatar }));
      return res.json({ guildId, members });
    }
    console.warn('Failed to fetch members from Discord', membersResp.status, membersResp.data);
    return res.status(membersResp.status).json({ error: 'Failed to fetch members', details: membersResp.data });
  }catch(e){ console.error('Failed to fetch guild members', e?.message || e); return res.status(500).json({ error: 'Failed to fetch guild members' }); }
});
// Fetch a single guild member by ID (returns basic user info)
app.get('/api/guild-member/:guildId/:memberId', async (req, res) => {
  const { guildId, memberId } = req.params;
  console.log('Request: /api/guild-member for', guildId, memberId);
  const presenceBase = process.env.BOT_PRESENCE_URL;
  const headers = {};
  if (BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = BOT_NOTIFY_SECRET;
  if (!BOT_TOKEN && presenceBase){
    try{
      const r = await axios.get(`${presenceBase.replace(/\/$/, '')}/guild-member/${encodeURIComponent(guildId)}/${encodeURIComponent(memberId)}`, { headers, timeout: 5000, validateStatus: () => true });
      if (r && r.status >= 200 && r.status < 300) return res.json(r.data);
      if (r && r.status === 404) return res.status(404).json({ error: 'Member not found' });
      console.warn('Presence proxy returned non-2xx', r.status, r.data);
      return res.status(r.status || 500).json({ error: 'Failed to fetch member from bot', details: r.data });
    }catch(e){ console.warn('Failed to proxy to bot presence for guild-member', e && e.message ? e.message : e); return res.status(500).json({ error: 'Failed to fetch member from bot' }); }
  }

  if (!BOT_TOKEN) { console.warn('BOT_TOKEN missing, cannot fetch guild member'); return res.status(501).json({ error: 'Bot token not configured on server' }); }
  try{
    const resp = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(memberId)}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 8000, validateStatus: () => true });
    console.log('/api/guild-member -> discord response status', resp.status);
    if (resp.status === 200){
      const m = resp.data || {};
      const user = m.user || {};
      return res.json({ guildId, member: { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar } });
    }
    if (resp.status === 404) return res.status(404).json({ error: 'Member not found' });
    console.warn('Failed to fetch member from Discord', resp.status, resp.data);
    return res.status(resp.status).json({ error: 'Failed to fetch member', details: resp.data });
  }catch(e){ console.error('Failed to fetch guild member', e?.message || e); return res.status(500).json({ error: 'Failed to fetch guild member' }); }
});
// Resolve channel info (name, mention) using bot token
app.get('/api/guild-channel/:guildId/:channelId', async (req, res) => {
  const guildId = req.params.guildId; const channelId = req.params.channelId;
  if (!BOT_TOKEN) { console.warn('BOT_TOKEN missing, cannot resolve channel'); return res.status(501).json({ error: 'Bot token not configured on server' }); }
  try{
    const resp = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/channels`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 8000, validateStatus: () => true });
    if (resp.status !== 200) { console.warn('Discord channels fetch returned', resp.status, resp.data); return res.status(resp.status).json({ error: 'Failed to fetch channels', details: resp.data }); }
    const ch = (resp.data || []).find(c => c.id === channelId || String(c.id) === String(channelId));
    if (!ch) return res.status(404).json({ error: 'Channel not found' });
    return res.json({ ok: true, channel: { id: ch.id, name: ch.name || null, type: ch.type || null, mention: `<#${ch.id}>` } });
  }catch(e){ console.warn('Failed to resolve channel', e); return res.status(500).json({ error: 'Failed to resolve channel' }); }
});

// Presence proxy: ask bot for presence cache if bot exposes such an endpoint
// Set BOT_PRESENCE_URL in .env to the bot base URL (e.g., http://localhost:4000)
app.get('/api/guild-presences/:guildId', async (req, res) => {
  const guildId = req.params.guildId;
  const presenceBase = process.env.BOT_PRESENCE_URL;
  const headers = {};
  if (BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = BOT_NOTIFY_SECRET;
  if (presenceBase){
    try{
      const url = `${presenceBase.replace(/\/$/, '')}/presences/${encodeURIComponent(guildId)}`;
      console.log('Proxying presence request to', url);
      const resp = await axios.get(url, { headers, timeout: 5000, validateStatus: () => true });
      if (resp.status >= 200 && resp.status < 300){ return res.json(resp.data); }
      console.warn('Presence proxy returned non-2xx', resp.status, resp.data);
    }catch(e){ console.warn('Failed to proxy presence request to bot', e?.message || e); }
  }

  // Fallback: read cached presences written when notifyBotOfPluginChange receives them
  try{
    const pFile = path.join(__dirname, 'data', 'presences.json');
    const raw = await fs.readFile(pFile, 'utf8');
    const all = JSON.parse(raw || '{}');
    const pres = all[guildId] || [];
    return res.json({ guildId, presences: pres });
  }catch(e){ /* ignore */ }

  return res.status(501).json({ error: 'No presence source configured' });
});

// Per-guild plugin state API (persistent)
app.get('/api/server-plugins/:guildId', async (req, res) => {
  const token = req.cookies?.ng_token; if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const guildId = req.params.guildId;
  const all = await loadPluginsFile();
  return res.json({ guildId, state: all[guildId] || {} });
});

// Simple activity log file for recent events
const ACTIVITY_FILE = path.join(__dirname, 'data', 'activity.json');
async function loadActivityFile(){
  try{ const raw = await fs.readFile(ACTIVITY_FILE, 'utf8'); return JSON.parse(raw || '[]'); }catch(e){ return []; }
}
async function saveActivityFile(arr){
  try{ await fs.mkdir(path.dirname(ACTIVITY_FILE), { recursive: true }); await fs.writeFile(ACTIVITY_FILE, JSON.stringify(arr, null, 2)); }catch(e){ console.warn('Failed to save activity file', e); }
}
async function appendActivity(entry){
  const arr = await loadActivityFile();
  arr.unshift(entry); // newest first
  // keep last 200 entries overall
  if (arr.length > 200) arr.splice(200);
  await saveActivityFile(arr);
}

// Expose activity for a guild
app.get('/api/server-activity/:guildId', async (req, res) => {
  const guildId = req.params.guildId; // allow public access (not sensitive)
  const all = await loadActivityFile();
  const items = all.filter(x => x.guildId === guildId).slice(0, 40);
  return res.json({ guildId, activity: items });
});

// Internal, authenticated plugin state endpoint for bots/tools to reconcile
app.get('/internal/server-plugins/:guildId', async (req, res) => {
  const secret = req.header('x-dashboard-secret') || '';
  if (!BOT_NOTIFY_SECRET || secret !== BOT_NOTIFY_SECRET) return res.status(403).json({ error: 'Forbidden' });
  const guildId = req.params.guildId;
  const all = await loadPluginsFile();
  return res.json({ guildId, state: all[guildId] || {} });
});

app.post('/api/server-plugins/:guildId', async (req, res) => {
  const token = req.cookies?.ng_token; if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const guildId = req.params.guildId; const body = req.body || {};
  // Accept either { pluginId, enabled } for single change, or { state: { ... } } for full replace, or full mapping
  const all = await loadPluginsFile();
  const prev = all[guildId] || {};
  const current = { ...prev };

  if (body.pluginId){ current[body.pluginId] = !!body.enabled; }
  else if (body.state && typeof body.state === 'object'){
    Object.assign(current, body.state);
  } else if (typeof body === 'object'){
    // treat body as a state mapping
    Object.assign(current, body);
  }

  // Save
  all[guildId] = current;
  await savePluginsFile(all);
  console.log('Saved plugin state for guild', guildId, all[guildId]);

  // record activity entries for any changes
  try{
    const changes = [];
    for (const k of new Set([...Object.keys(prev), ...Object.keys(current)])){
      const before = !!prev[k];
      const after = !!current[k];
      if (before !== after){
        changes.push({ pluginId: k, from: before, to: after });
      }
    }
    const userJson = req.cookies?.ng_user || null;
    let user = null;
    try{ user = userJson ? JSON.parse(userJson) : null; }catch(e){}
    for (const c of changes){
      const entry = { guildId, type: 'plugin_update', pluginId: c.pluginId, enabled: c.to, user: (user ? { id: user.id, username: user.username+'#'+user.discriminator } : null), ts: Date.now() };
      await appendActivity(entry);
    }
  }catch(e){ console.warn('Failed to record activity', e); }

  // Notify the bot (best-effort) and wait so we can observe logging
  try{
    await notifyBotOfPluginChange(guildId, all[guildId]);
  }catch(e){ console.warn('notifyBotOfPluginChange error', e?.message || e); }

  return res.json({ ok: true, state: all[guildId] });
});

// Logout - clears cookies set by OAuth callback
app.get('/logout', (req, res) => {
  res.clearCookie('ng_token');
  res.clearCookie('ng_user');
  res.redirect('/');
});

// Serve favicon.ico to avoid 404 logs (serve root favicon.svg if present)
app.get('/favicon.ico', (req, res) => {
  const p = path.join(__dirname, 'favicon.svg');
  return res.sendFile(p);
});

// Invite redirect (server-side) using configured client ID and permissions
// Behavior:
// - If ENABLE_INVITE_REDIRECT=true (and you've added `${BASE_URL}/invite-callback` to your app's redirect URIs), Discord will redirect back to `/invite-callback` after invite.
// - Otherwise we use the simple bot invite URL (no redirect) to avoid "Invalid Redirect" errors. The client will open this invite in a new tab and poll for bot presence to auto-redirect the user when the bot joins.
app.get('/invite-now', (req, res) => {
  const botId = process.env.DISCORD_CLIENT_ID;
  const perms = process.env.DISCORD_PERMISSIONS || '8';
  if (!botId) return res.status(500).send('Server not configured with Discord client ID for invites. Set DISCORD_CLIENT_ID in .env');
  const enableRedirect = process.env.ENABLE_INVITE_REDIRECT === 'true';

  const paramsObj = { client_id: botId, permissions: perms, scope: 'bot' };
  if (req.query.guild_id) {
    paramsObj.guild_id = req.query.guild_id;
    paramsObj.disable_guild_select = 'true';
    if (enableRedirect) {
      // Add OAuth redirect so Discord returns the user to our server after they authorize the bot
      paramsObj.response_type = 'code';
      paramsObj.redirect_uri = `${BASE_URL}/invite-callback`;
      paramsObj.state = req.query.guild_id;
    }
  }

  const params = new URLSearchParams(paramsObj);
  return res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

// Invite callback: user is redirected here after authorizing the bot (if `guild_id` was used as state)
// We simply forward the user to the server dashboard for the guild they invited the bot to
app.get('/invite-callback', async (req, res) => {
  const guildId = req.query.state || null;
  // Try to update bot presence cache immediately so dashboards reflect the new state faster
  if (guildId && BOT_TOKEN && BOT_ID){
    try{
      const memberResp = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members/${BOT_ID}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
      const present = memberResp.status === 200;
      botPresenceCache.set(guildId, { present, expiresAt: Date.now() + BOT_PRESENCE_TTL_MS });

      // Update any cached guild lists so they show the new presence immediately
      try{
        for (const [key, val] of guildsCache.entries()){
          if (val && Array.isArray(val.guilds)){
            let changed = false;
            for (const g of val.guilds){ if (g && String(g.id) === String(guildId)) { g.bot_present = present; changed = true; }}
            if (changed){ guildsCache.set(key, { guilds: val.guilds, expiresAt: val.expiresAt }); }
          }
        }
        // Invalidate guild list cache entries so subsequent /api/guilds calls will re-fetch fresh data
        for (const key of Array.from(guildsCache.keys())){ guildsCache.delete(key); }
      }catch(e){ console.warn('Failed to update cached guild lists after invite', e); }
    }catch(e){ console.warn('invite-callback presence check failed', e?.message || e); }
  }

  if (guildId){
    // Attempt to fetch guild metadata (name) so the dashboard can display it immediately after redirect
    let nameParam = '';
    try{
      if (BOT_TOKEN){
        const guildResp = await axios.get(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 5000, validateStatus: () => true });
        if (guildResp && guildResp.status === 200 && guildResp.data && guildResp.data.name){ nameParam = `&name=${encodeURIComponent(guildResp.data.name)}`; }
      }
    }catch(e){ console.warn('Failed to fetch guild metadata during invite-callback', e?.message || e); }

    return res.redirect(`/server-dashboard.html?id=${encodeURIComponent(guildId)}${nameParam}`);
  }
  return res.redirect('/dashboard.html');
});

// Redirect user to Discord authorize page (server-side redirect)
app.get('/auth', (req, res) => {
  if (!CLIENT_ID) return res.status(500).send('Server not configured with Discord client ID. See .env.example');
  // Build redirect URI dynamically based on incoming request when BASE_URL is not explicitly set
  const redirect = process.env.BASE_URL ? `${process.env.BASE_URL.replace(/\/$/, '')}/callback` : `${req.protocol}://${req.get('host')}/callback`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'identify guilds'
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

// OAuth callback: exchange code for token and fetch user
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');
  try {
    // When exchanging the code, ensure the redirect_uri matches what was used for /auth. Derive dynamically if BASE_URL isn't set.
    const redirectUri = process.env.BASE_URL ? `${process.env.BASE_URL.replace(/\/$/, '')}/callback` : `${req.protocol}://${req.get('host')}/callback`;
    const tokenResp = await axios.post('https://discord.com/api/oauth2/token', qs.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const access_token = tokenResp.data.access_token;
    // fetch user
    const userResp = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
    const user = userResp.data;

    // Set a simple cookie with token. Use secure cookies when on HTTPS and be slightly stricter in production.
    const cookieOptions = { maxAge: 24*60*60*1000, httpOnly: false, secure: (req.secure || req.protocol === 'https' || process.env.NODE_ENV === 'production'), sameSite: 'lax' };
    res.cookie('ng_token', access_token, cookieOptions);
    res.cookie('ng_user', JSON.stringify(user), cookieOptions);

    // Redirect back to the dashboard UI
    return res.redirect('/dashboard.html');
  } catch (err) {
    console.error('OAuth callback error', err.response?.data || err.message || err);
    return res.status(500).send('OAuth exchange failed. Check console for details.');
  }
});

// If a BOT_NOTIFY_URL is configured, periodically poll it for stats (GET /stats)
async function pollBotStatsOnce(){
  if (!BOT_NOTIFY_URL) return;
  const base = BOT_NOTIFY_URL.replace(/\/$/, '');
  // Support polling both the configured notify URL and the origin root (in case BOT_NOTIFY_URL points at /webhook)
  let origin = base;
  try{ origin = new URL(BOT_NOTIFY_URL).origin; }catch(e){}
  const tryUrls = Array.from(new Set([ base + '/stats', base, base + '/presence', origin + '/stats', origin, origin + '/presence' ]));
  const headers = {};
  if (BOT_NOTIFY_SECRET) headers['x-dashboard-secret'] = BOT_NOTIFY_SECRET;
  for (const url of tryUrls){
    try{
      const r = await axios.get(url, { headers, timeout: Math.max(5000, BOT_NOTIFY_TIMEOUT_MS), validateStatus: () => true });
      if (r && r.status >= 200 && r.status < 300 && r.data){
        const data = r.data.stats || r.data || {};
        // Accept either full stats or partials
        if (data && (typeof data.guildCount === 'number' || typeof data.commandsToday === 'number' || typeof data.totalMembers === 'number')){
          updateBotStats(data);
          if (typeof data.totalMembers === 'number') botStats.totalMembers = data.totalMembers;
          console.log('Polled bot stats from', url);
          return;
        }
      }
    }catch(e){ console.warn('pollBotStatsOnce fetch failed', url, e && e.message ? e.message : e); }
  }
}

if (BOT_NOTIFY_URL){
  // Warm-up poll shortly after start, then schedule regular polls
  setTimeout(()=>{ try{ pollBotStatsOnce(); }catch(e){} setInterval(()=>{ try{ pollBotStatsOnce(); }catch(e){} }, BOT_STATS_POLL_INTERVAL_MS); }, 2500);
}

// Start HTTP server and attach Socket.IO for live updates
const server = http.createServer(app);
try{
  io = new SocketIOServer(server, { /* default options */ });
  io.on('connection', (socket)=>{
    console.log('Socket connected', socket.id);
    try{
      const uptimeHours = Math.floor((Date.now() - (botStats.uptimeStart || Date.now())) / (1000*60*60));
      socket.emit('bot-stats', { stats: { guildCount: botStats.guildCount, totalMembers: botStats.totalMembers, commandsToday: botStats.commandsToday, uptimeHours, lastUpdated: botStats.lastUpdated } });
      socket.emit('bot-stats-history', { history: botStats.history || [] });
    }catch(e){ /* ignore */ }
  });
}catch(e){ console.warn('Failed to initialize Socket.IO', e); }

server.listen(PORT, () => {
  console.log(`Server running on ${BASE_URL}`);
  console.log('Endpoints: /auth -> redirect to Discord, /callback -> OAuth callback');
  console.log('BASE_URL resolved to:', process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`));
  console.log('Tip: If running on Vercel, set BASE_URL in your Environment Variables to the site URL (e.g., https://noctis-guard.vercel.app) so Discord OAuth redirect URIs match.');
});