module.exports = (req, res) => {
  // Clear cookies and redirect to /
  const cookies = [];
  cookies.push(`ng_token=; Max-Age=0; Path=/`);
  cookies.push(`ng_user=; Max-Age=0; Path=/`);
  res.setHeader('Set-Cookie', cookies);
  res.writeHead(302, { Location: '/' });
  res.end();
};