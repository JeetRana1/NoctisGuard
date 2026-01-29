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
  ['/server-giveaway-reroll', require('../serverless-handlers/server-giveaway-reroll')],
  ['/stats-history', require('../serverless-handlers/stats-history')],
  ['/stats', require('../serverless-handlers/stats')],
  ['/recent-guild-events', require('../serverless-handlers/recent-guild-events')],
  ['/guild-presences', require('../serverless-handlers/guild-presences')],
  ['/server-plugin-test', require('../serverless-handlers/server-plugin-test')],
  ['/callback', require('../serverless-handlers/callback')],
  ['/invite-callback', require('../serverless-handlers/invite-callback')],
  ['/bot-event', require('../serverless-handlers/bot-event')],
]);

// Helper to parse request body
async function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body) return resolve(req.body);
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

// Helper to add response methods
function enhanceResponse(res) {
  if (!res.json) {
    res.json = function(data) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(data));
    };
  }
  if (!res.redirect) {
    res.redirect = function(location) {
      this.statusCode = 302;
      this.setHeader('Location', location);
      this.end();
    };
  }
  if (!res.status) {
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };
  }
  return res;
}

module.exports = async (req, res) => {
  try{
    // Enhance response with helper methods
    enhanceResponse(res);
    
    // Parse body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.body = await parseBody(req);
    }
    
    // Parse query parameters
    const urlParts = (req.url || '/').split('?');
    const path = urlParts[0];
    const queryString = urlParts[1] || '';
    req.query = {};
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key) req.query[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      });
    }

    // Normalize incoming path: remove /api prefix if present
    let normalizedPath = path;
    if (normalizedPath.startsWith('/api/')) normalizedPath = normalizedPath.slice(4);
    if (normalizedPath === '/api') normalizedPath = '/';

    // Try to find a handler whose prefix matches the start of the path
    for (const [prefix, fn] of handlers.entries()){
      if (normalizedPath === prefix || normalizedPath.startsWith(prefix + '/') || normalizedPath.startsWith(prefix + '?')){
        return await fn(req, res);
      }
    }
    
    // No match
    res.status(404).json({ error: 'Not found', path: normalizedPath });
  }catch(e){
    console.error('api/index router error', e);
    try{
      if (!res.headersSent) {
        res.status(500).json({ error: 'internal_error', message: String(e) });
      }
    }catch(_){}
  }
};