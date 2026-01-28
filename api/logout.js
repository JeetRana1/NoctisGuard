module.exports = (req, res) => {
  // Clear cookies and redirect to /
  const cookies = [];
  const delOpts = `Max-Age=0; Path=/; SameSite=None; Secure`;
  cookies.push(`ng_token=; ${delOpts}`);
  cookies.push(`ng_user=; ${delOpts}`);
  res.setHeader('Set-Cookie', cookies);
  res.writeHead(302, { Location: '/' });
  res.end();
};