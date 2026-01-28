// bot-webhook-example.js
// Minimal example of a webhook receiver for plugin updates from the dashboard.
// Drop this into your bot's project (requires Express and node-fetch or axios).

require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const app = express();
app.use(express.json()); // parse json body

const PORT = process.env.BOT_WEBHOOK_PORT || 4000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-me-to-a-secret';
const DASHBOARD_BASE = process.env.DASHBOARD_BASE || 'https://noctis-guard.vercel.app';
const PLUGINS_FILE = path.join(__dirname, 'data', 'bot-guild-config.json');

// Simple in-memory config (persisted to disk)
let guildConfig = {};
async function loadGuildConfig(){
  try{ const raw = await fs.readFile(PLUGINS_FILE, 'utf8'); guildConfig = JSON.parse(raw || '{}'); }catch(e){ guildConfig = {}; }
}
async function saveGuildConfig(){
  try{ await fs.mkdir(path.dirname(PLUGINS_FILE), { recursive: true }); await fs.writeFile(PLUGINS_FILE, JSON.stringify(guildConfig, null, 2)); }catch(e){ console.warn('Failed to save guild config', e); }
}

// Middleware to verify secret header
function verifySecret(req, res, next){
  const h = req.header('x-dashboard-secret') || '';
  if (!WEBHOOK_SECRET || h !== WEBHOOK_SECRET){ return res.status(403).json({ error: 'Forbidden' }); }
  next();
}

/*
  Integration notes:
  - In your bot's main startup file (where you create your Discord client), require this module and attach the client:
      const { startWebhookListener, attachClient, reconcileAllGuilds } = require('./bot-webhook-example');
      startWebhookListener(client); // starts the webhook server and accepts optional client
      attachClient(client); // attach client if you start listener earlier without client
      client.once('ready', async () => { await reconcileAllGuilds(client); });
  - Set environment variables:
      WEBHOOK_SECRET (matches dashboard BOT_NOTIFY_SECRET)
      BOT_WEBHOOK_PORT (optional, defaults to 4000)
*/

// Start webhook listener (accepts optional Discord client to provide presence info)
let attachedClient = null;
function attachClient(client){ attachedClient = client; }
function startWebhookListener(client){
  attachedClient = client || attachedClient;
  const app = express();
  app.use(express.json());

  app.post('/webhook', verifySecret, async (req, res) => {
    const { type, guildId, state } = req.body || {};

    if (type === 'plugin_update' && guildId){
      // Persist state and update in-memory map
      guildConfig[guildId] = guildConfig[guildId] || {};
      guildConfig[guildId].plugins = state || {};
      // Convenience: derive a list of disabled plugins
      guildConfig[guildId].disabled = Object.keys(state || {}).filter(k => !state[k]);

      await saveGuildConfig();

      // Here you should update your bot runtime state (command visibility, module loading, etc.)
      // Example (pseudocode):
      // if (attachedClient.guilds.cache.has(guildId)) {
      //   const g = attachedClient.guilds.cache.get(guildId);
      //   updateGuildCommands(g, guildConfig[guildId]);
      // }

      console.log('Received plugin update for', guildId, guildConfig[guildId]);

      // If a Discord client was provided, include presence snapshot in response
      let presences = [];
      try{
        if (attachedClient && attachedClient.guilds && attachedClient.guilds.cache.has(guildId)){
          const guild = attachedClient.guilds.cache.get(guildId);
          // best-effort: fetch some members into cache
          try{ await guild.members.fetch({ limit: 100 }); }catch(e){}
          guild.members.cache.forEach(m => {
            presences.push({ id: m.id, status: (m.presence && m.presence.status) ? m.presence.status : 'offline' });
          });
        }
      }catch(e){ console.warn('Failed to gather presences', e); }

      return res.json({ ok: true, presences });
    }

    // Accept plugin config updates (welcome/bye templates)
    if (type === 'plugin_config' && guildId){
      const pluginId = req.body.pluginId || 'welcome';
      const config = req.body.config || {};
      guildConfig[guildId] = guildConfig[guildId] || {};
      guildConfig[guildId].config = guildConfig[guildId].config || {};
      guildConfig[guildId].config[pluginId] = config;
      await saveGuildConfig();

      // If your bot exposes moderation/welcome managers, apply immediately
      try{
        const moderation = require('./moderationManager');
        if (pluginId === 'welcome' && moderation && typeof moderation.setGuildConfig === 'function'){
          moderation.setGuildConfig(guildId, { welcomeChannelId: config.welcome?.channel || null, welcomeMessage: config.welcome?.message || null, byeChannelId: config.bye?.channel || null, byeMessage: config.bye?.message || null });
          console.log('Applied welcome config to moderation manager for', guildId);
        }
      }catch(e){ /* optional: your bot may structure managers differently */ }

      // If your bot has a giveaway manager, apply giveaway defaults/config
      try{
        const giveaway = require('./giveawayManager');
        if (pluginId === 'giveaway' && giveaway){
          // prefer explicit method names used by some bots
          if (typeof giveaway.setGuildDefaults === 'function'){
            giveaway.setGuildDefaults(guildId, config.giveaway || config);
            console.log('Applied giveaway defaults to giveaway manager for', guildId);
          } else if (typeof giveaway.setGuildConfig === 'function'){
            giveaway.setGuildConfig(guildId, config.giveaway || config);
            console.log('Applied giveaway config to giveaway manager for', guildId);
          } else {
            // fallback: assign to an exposed config map if available
            if (!giveaway.configs) giveaway.configs = {}; giveaway.configs[guildId] = config.giveaway || config;
            console.log('Stored giveaway config in giveaway.manager (fallback) for', guildId);
          }
        }
      }catch(e){ /* optional: giveaway manager not present */ }

      // Mirror response with presence snapshot if available
      let presences = [];
      try{
        if (attachedClient && attachedClient.guilds && attachedClient.guilds.cache.has(guildId)){
          const guild = attachedClient.guilds.cache.get(guildId);
          try{ await guild.members.fetch({ limit: 100 }); }catch(e){}
          guild.members.cache.forEach(m => { presences.push({ id: m.id, status: (m.presence && m.presence.status) ? m.presence.status : 'offline' }); });
        }
      }catch(e){ console.warn('Failed to gather presences', e); }

      return res.json({ ok: true, presences });
    }

    // Handle plugin test requests (send a sample welcome/bye)
    if (type === 'plugin_test' && guildId){
      const pluginId = req.body.pluginId || 'welcome';
      const payload = req.body.payload || {};
      const testType = payload.testType || 'welcome';
      const userId = payload.userId || null;
      guildConfig[guildId] = guildConfig[guildId] || {};
      guildConfig[guildId].config = guildConfig[guildId].config || {};

      let didSend = false;
      try{
        // try to use welcome manager if present
        const welcome = require('./welcomeManager');
        if (attachedClient && attachedClient.guilds && attachedClient.guilds.cache.has(guildId)){
          const guild = attachedClient.guilds.cache.get(guildId);
          let member = null;
          if (userId){ try{ member = await guild.members.fetch(userId).catch(()=>null); }catch(e){} }
          if (!member){ try{ member = await guild.members.fetch(guild.ownerId).catch(()=>null); }catch(e){} }

          if (testType === 'welcome' && member && welcome && typeof welcome.sendWelcome === 'function'){
            didSend = await welcome.sendWelcome(member, { channelId: guildConfig[guildId].config?.welcome?.channel || undefined, message: guildConfig[guildId].config?.welcome?.message });
          } else if (testType === 'bye'){
            const fake = member || { user: { id: '0', username: 'Test' }, guild };
            if (welcome && typeof welcome.sendBye === 'function'){
              didSend = await welcome.sendBye(fake, { channelId: guildConfig[guildId].config?.bye?.channel || undefined, message: guildConfig[guildId].config?.bye?.message });
            }
          }
        }
      }catch(e){ console.warn('Failed to execute plugin test', e); }

      // return presence snapshot too if available
      let presences = [];
      try{
        if (attachedClient && attachedClient.guilds && attachedClient.guilds.cache.has(guildId)){
          const guild = attachedClient.guilds.cache.get(guildId);
          try{ await guild.members.fetch({ limit: 100 }); }catch(e){}
          guild.members.cache.forEach(m => { presences.push({ id: m.id, status: (m.presence && m.presence.status) ? m.presence.status : 'offline' }); });
        }
      }catch(e){ /* ignore */ }

      return res.json({ ok: true, didSend: !!didSend, presences });
    }

    return res.status(400).json({ error: 'Bad request' });
  });

  // Helpful GET endpoint so you can verify the webhook service in a browser
  app.get('/webhook', (req, res) => {
    res.json({
      ok: true,
      info: 'POST /webhook expects JSON body { type:"plugin_update", guildId, state } and header x-dashboard-secret',
      examples: {
        curl: `curl -X POST https://noctis-guard.vercel.app/webhook -H "x-dashboard-secret: ${WEBHOOK_SECRET}" -H "Content-Type: application/json" -d '{"type":"plugin_update","guildId":"123","state":{"moderation":false}}'`,
        powershell: `curl -Method POST -Uri https://noctis-guard.vercel.app/webhook -Headers @{"x-dashboard-secret"="${WEBHOOK_SECRET}"} -Body '{"type":"plugin_update","guildId":"123","state":{"moderation":false}}' -ContentType 'application/json'`
      }
    });
  });

  // Simple stats exposure for dashboard to poll (GET /stats) and an update route (POST /stats)
  // Protect with same x-dashboard-secret header used for webhook
  let botStats = { guildCount: 0, totalMembers: 0, commandsToday: 0 };

  // Helper to compute live counts if client attached (best-effort)
  async function computeLiveStats(){
    try{
      if (!attachedClient) return botStats;
      let guildCount = 0; let totalMembers = 0;
      if (attachedClient.guilds && attachedClient.guilds.cache){ guildCount = attachedClient.guilds.cache.size; }
      // Try to sum memberCount if available (note: may be approximate)
      try{ attachedClient.guilds.cache.forEach(g => { totalMembers += (g.memberCount || 0); }); }catch(e){}
      botStats.guildCount = guildCount; botStats.totalMembers = totalMembers; return botStats;
    }catch(e){ return botStats; }
  }

  app.get('/stats', verifySecret, async (req, res) => {
    try{
      const s = await computeLiveStats(); return res.json({ ok: true, stats: s });
    }catch(e){ return res.status(500).json({ error: 'Failed to compute stats' }); }
  });

  // Allow setting/updating stats (useful for internal counters or when aggregating)
  app.post('/stats', verifySecret, async (req, res) => {
    try{
      const body = req.body || {};
      if (typeof body.commandsToday === 'number') botStats.commandsToday = body.commandsToday;
      if (typeof body.guildCount === 'number') botStats.guildCount = body.guildCount;
      if (typeof body.totalMembers === 'number') botStats.totalMembers = body.totalMembers;
      return res.json({ ok:true, stats: botStats });
    }catch(e){ return res.status(500).json({ error: 'Failed to update stats' }); }
  });

  const server = app.listen(PORT, () => console.log(`Bot webhook listening on ${PORT}`));
  return server;
}

// If script is run directly, start listener without a client
if (require.main === module){ startWebhookListener(null); }

// Optional helper for your main bot process to increment commandsToday counter
function incrementCommands(by=1){ try{ botStats.commandsToday = (botStats.commandsToday || 0) + Number(by); }catch(e){} }

module.exports = { startWebhookListener, attachClient, fetchPluginStateFromDashboard, reconcileAllGuilds, guildConfig, incrementCommands };

// Helpful GET endpoint so you can verify the webhook service in a browser
app.get('/webhook', (req, res) => {
  res.json({
    ok: true,
    info: 'POST /webhook expects JSON body { type:"plugin_update", guildId, state } and header x-dashboard-secret',
    examples: {
      curl: `curl -X POST https://noctis-guard.vercel.app/webhook -H "x-dashboard-secret: ${WEBHOOK_SECRET}" -H "Content-Type: application/json" -d '{"type":"plugin_update","guildId":"123","state":{"moderation":false}}'`,
        powershell: `curl -Method POST -Uri https://noctis-guard.vercel.app/webhook -Headers @{"x-dashboard-secret"="${WEBHOOK_SECRET}"} -Body '{"type":"plugin_update","guildId":"123","state":{"moderation":false}}' -ContentType 'application/json'`
    }
  });
});

// Optional: endpoint to ask the dashboard directly for current plugin state for a guild
// Useful on bot startup to reconcile state in case a webhook was missed
async function fetchPluginStateFromDashboard(guildId){
  try{
    const res = await axios.get(`${DASHBOARD_BASE}/api/server-plugins/${encodeURIComponent(guildId)}`, { withCredentials: false, timeout: 5000 });
    if (res?.data?.state){
      guildConfig[guildId] = guildConfig[guildId] || {};
      guildConfig[guildId].plugins = res.data.state || {};
      guildConfig[guildId].disabled = Object.keys(res.data.state || {}).filter(k => !res.data.state[k]);
      await saveGuildConfig();
      return true;
    }
  }catch(e){ console.warn('Failed to fetch plugin state for', guildId, e?.message || e); }
  return false;
}

// Example helper for your bot startup to reconcile for all joined guilds
async function reconcileAllGuilds(client){
  await loadGuildConfig();
  for (const [id, g] of client.guilds.cache){
    // Try webhook-synced config first, otherwise ask dashboard
    if (!guildConfig[id] || !guildConfig[id].plugins){
      await fetchPluginStateFromDashboard(id);
    }
    // Apply changes to your bot's runtime (e.g., hide commands)
    // updateGuildCommands(g, guildConfig[id]);
  }
}

// Start webhook listener
app.listen(PORT, () => console.log(`Bot webhook listening on ${PORT}`));

module.exports = { startWebhookListener, attachClient, fetchPluginStateFromDashboard, reconcileAllGuilds, guildConfig };
