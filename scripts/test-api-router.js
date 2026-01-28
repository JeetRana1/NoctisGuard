const httpMocks = require('node-mocks-http');
const api = require('../api/index');

async function run(){
  const req = httpMocks.createRequest({ method: 'GET', url: '/me', headers: { cookie: '' } });
  const res = httpMocks.createResponse({ eventEmitter: require('events').EventEmitter });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try{ console.log('Body:', res._getData()); }catch(e){ console.log('Body unreadable'); }
  });
  await api(req, res);
}

run().catch(err => { console.error(err); process.exit(1); });