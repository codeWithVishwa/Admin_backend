// Middleware to allow only specific roles (e.g., admin, moderator)
module.exports = function allowedRoles(roles = []) {
  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient role' });
    }
    next();
  };
};
