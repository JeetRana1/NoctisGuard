const fs = require('fs');
const s = fs.readFileSync('c:/Users/Jeet/Videos/DiscordBOTWEB/server-dashboard.html', 'utf8');
const start = s.indexOf('window.showWinnersModal = async function');
const end = s.indexOf('window.safeShowWinnersModal', start);
if (start === -1 || end === -1) { console.error('Could not find snippet boundaries'); process.exit(2); }
const lines = s.slice(start, end).split(/\r?\n/);
for (let i = 1; i <= lines.length; i++) {
  const chunk = '(async function(){\n' + lines.slice(0, i).join('\n') + '\n})()';
  try {
    new Function(chunk);
  } catch (e) {
    console.log('first failing at snippet line', i, 'source:', lines[i - 1].trim());
    console.log('error:', e.message);
    process.exit(0);
  }
}
console.log('no failure found in snippet');
