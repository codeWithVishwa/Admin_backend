module.exports = function (req, res, next) {
  // Assume req.user is set by previous auth middleware
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
