const Moderator = require('../models/moderator.model');
const bcrypt = require('bcryptjs');
const ModeratorAction = require('../models/moderatorAction.model');

// Utility to log moderator actions
exports.logModeratorAction = async (moderatorId, action, targetType, targetId, details = {}) => {
  await ModeratorAction.create({
    moderator: moderatorId,
    action,
    targetType,
    targetId,
    details,
  });
};

// Admin creates a new moderator
exports.createModerator = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const existing = await Moderator.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: 'Moderator with this email already exists' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const moderator = await Moderator.create({ name, email, password: hashedPassword });
  res.status(201).json({
    _id: moderator._id,
    name: moderator.name,
    email: moderator.email,
    createdAt: moderator.createdAt,
  });
};

// Admin gets all moderators
exports.getAllModerators = async (req, res) => {
  const moderators = await Moderator.find(
    {},
    "name email status createdAt"
  );
  res.json(moderators);
};
