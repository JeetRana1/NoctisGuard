const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const p = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(p, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send ? res.status(200).send(html) : res.status(200).end(html);
  } catch (err) {
    console.warn('api/root error', err && err.message);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send ? res.status(500).send('<h1>Server error</h1>') : res.status(500).end('<h1>Server error</h1>');
  }
};