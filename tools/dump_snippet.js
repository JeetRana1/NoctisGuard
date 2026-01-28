const fs=require('fs');
const s=fs.readFileSync('c:/Users/Jeet/Videos/DiscordBOTWEB/server-dashboard.html','utf8');
const start = s.indexOf('window.showWinnersModal = async function');
const end = s.indexOf('window.safeShowWinnersModal', start);
if (start === -1 || end === -1){ console.error('snippet boundaries not found'); process.exit(2); }
const lines = s.slice(start,end).split(/\r?\n/);
for(let i=0;i<Math.min(200,lines.length);i++){
  console.log((i+1).toString().padStart(4,' '), lines[i]);
}
