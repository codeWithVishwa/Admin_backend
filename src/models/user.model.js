const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  verified:Boolean,
  isVerified: { type: Boolean, default: false },
  verificationType: { type: String, enum: ['official', 'creator', 'developer'], default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  verifiedAt: { type: Date, default: null },
  lastIp: String,
  lastOnline: Date,
  // Compatibility with main Backend (presence tracking)
  lastActiveAt: Date,
  lastLoginAt: Date,
  status: { type: String, enum: ['active', 'banned', 'suspended'], default: 'active' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  avatarUrl:String,
  pushToken: String,
  pushTokenUpdatedAt: Date,
  createdAt: { type: Date, default: Date.now }
  
});
module.exports = mongoose.model('User', userSchema);
