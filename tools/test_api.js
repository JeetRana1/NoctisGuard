const axios = require('axios');
(async ()=>{
  const base = 'https://noctis-guard.vercel.app';
  const endpoints = [
    '/api/guild-member/1/1',
    '/api/guild-members/1?limit=1',
    '/api/me'
  ];
  for (const ep of endpoints){
    try{
      console.log('GET', base+ep);
      const r = await axios.get(base+ep, { validateStatus: () => true, timeout: 5000 });
      console.log('  status', r.status);
      console.log('  body', typeof r.data === 'object' ? JSON.stringify(r.data) : r.data);
    }catch(e){
      console.error('  error', e.message);
    }
  }
})();