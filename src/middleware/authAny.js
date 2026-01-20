const jwt = require('jsonwebtoken');
const Admin = require('../models/admin.model');
const Moderator = require('../models/moderator.model');

function getBearerToken(req) {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

// Sets req.user for either:
// - Admin: cookie `admin_token` signed with JWT_SECRET
// - Moderator: Authorization Bearer <accessToken> signed with ACCESS_TOKEN_SECRET
//
// If neither is present/valid -> 401.
module.exports = async function authAny(req, res, next) {
  try {
    const adminToken = req.cookies?.admin_token;
    if (adminToken) {
      const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
      const admin = await Admin.findById(decoded._id, 'name email role');
      if (!admin) return res.status(401).json({ error: 'Not authenticated' });

      req.user = {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role || 'admin',
      };

      return next();
    }

    const moderatorAccessToken = getBearerToken(req);
    if (moderatorAccessToken) {
      const decoded = jwt.verify(moderatorAccessToken, process.env.ACCESS_TOKEN_SECRET);
      if (decoded.role !== 'moderator') {
        return res.status(403).json({ error: 'Moderator access required' });
      }

      const moderator = await Moderator.findById(decoded.id, 'name email role status');
      if (!moderator) return res.status(401).json({ error: 'Not authenticated' });
      if (moderator.status === 'banned') {
        return res.status(403).json({ error: 'Your moderator account has been banned.' });
      }

      req.user = {
        _id: moderator._id,
        name: moderator.name,
        email: moderator.email,
        role: moderator.role || 'moderator',
      };

      return next();
    }

    return res.status(401).json({ error: 'Not authenticated' });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
