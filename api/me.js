module.exports = (req, res) => {
  // No user session is available on Vercel by default.
  // Return 401 so client-side falls back to local mode for dashboard features.
  res.status(401).json({ error: 'Not authenticated' });
};