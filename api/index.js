// Single entrypoint router for all API endpoints to avoid many serverless functions on Vercel Hobby

const handlers = new Map([
  ['/me', require('../serverless-handlers/me')],
  ['/guilds', require('../serverless-handlers/guilds')],
  ['/guild', require('../serverless-handlers/guild')],
  ['/guild-members', require('../serverless-handlers/guild-members')],
  ['/guild-member', require('../serverless-handlers/guild-member')],
  ['/server-plugins', require('../serverless-handlers/server-plugins')],
  ['/server-plugin-config', require('../serverless-handlers/server-plugin-config')],
  ['/server-activity', require('../serverless-handlers/server-activity')],
  ['/server-giveaways', require('../serverless-handlers/server-giveaways')],
  ['/stats-history', require('../serverless-handlers/stats-history')],
  ['/stats', require('../serverless-handlers/stats')],
  ['/recent-guild-events', require('../serverless-handlers/recent-guild-events')],
  ['/callback', require('../serverless-handlers/callback')],
  ['/invite-callback', require('../serverless-handlers/invite-callback')],
]);

module.exports = async (req, res) => {
  try{
    const url = req.url || '/';
    // Try to find a handler whose prefix matches the start of the path
    for (const [prefix, fn] of handlers.entries()){
      if (url === prefix || url.startsWith(prefix + '/') || url.startsWith(prefix + '?')){
        return fn(req, res);
      }
    }
    // No match
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  }catch(e){
    console.error('api/index router error', e);
    try{ res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'internal_error', message: String(e) })); }catch(_){}
  }
};