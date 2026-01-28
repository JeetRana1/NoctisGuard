#!/usr/bin/env node
// scripts/test-bot-integration.js
// Usage: node scripts/test-bot-integration.js <BOT_BASE_URL> <SECRET> [<GUILD_ID>]
// Example: node scripts/test-bot-integration.js https://abcd1234.ngrok.io 'mysecret' 123456789012345678

const axios = require('axios');

async function main(){
  const argv = process.argv.slice(2);
  if (argv.length < 2){
    console.error('Usage: node scripts/test-bot-integration.js <BOT_BASE_URL> <SECRET> [<GUILD_ID>]');
    process.exit(1);
  }
  const base = argv[0].replace(/\/$/, '');
  const secret = argv[1];
  const guildId = argv[2] || null;

  console.log('Testing bot at', base);

  // 1) Health
  try{
    const r = await axios.get(base + '/webhook/health', { headers: { 'x-dashboard-secret': secret }, timeout: 5000, validateStatus: () => true });
    console.log('\n/webhook/health ->', r.status, r.data);
  }catch(e){ console.error('\nHealth check failed:', e.message || e); }

  // 2) If guildId provided, check presence
  if (guildId){
    try{
      const pr = await axios.get(base + '/presences/' + encodeURIComponent(guildId), { headers: { 'x-dashboard-secret': secret }, timeout: 5000, validateStatus: () => true });
      console.log('\n/presences/' + guildId + ' ->', pr.status, pr.data && (Array.isArray(pr.data.presences) ? `presences=${pr.data.presences.length}` : pr.data));
    }catch(e){ console.error('\nPresence fetch failed:', e.message || e); }
  }

  // 3) Send a plugin_update test
  try{
    const payload = { type: 'plugin_update', guildId: guildId || 'test-guild', state: { moderation: true, music: false } };
    const tr = await axios.post(base + '/webhook', payload, { headers: { 'x-dashboard-secret': secret, 'Content-Type': 'application/json' }, timeout: 5000, validateStatus: () => true });
    console.log('\nPOST /webhook (plugin_update) ->', tr.status, tr.data);
  }catch(e){ console.error('\nPOST /webhook failed:', e.response ? (e.response.status + ' ' + JSON.stringify(e.response.data)) : (e.message || e)); }

  // 4) Ask bot to re-check dashboard stats endpoint (internal recompute) - optional
  try{
    const rr = await axios.post(base + '/internal/recompute-stats', {}, { headers: { 'x-dashboard-secret': secret }, timeout: 5000, validateStatus: () => true });
    console.log('\nPOST /internal/recompute-stats ->', rr.status, rr.data);
  }catch(e){ console.error('\nRecompute stats failed:', e.message || e); }
}

main().catch(e=>{ console.error('Test runner failed', e); process.exit(1); });