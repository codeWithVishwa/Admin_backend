const mongoose = require('mongoose');
const moderatorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Store hashed password in production
  role: { type: String, enum: ['moderator'], default: 'moderator' },
  status: {
    type: String,
    enum: ['active', 'banned'],
    default: 'active',
  },
  bannedAt: { type: Date },
  bannedReason: { type: String },
  refreshTokens: [{ type: String }], 
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Moderator', moderatorSchema);
