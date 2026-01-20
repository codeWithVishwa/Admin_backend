const mongoose = require('mongoose');

const verificationLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  action: { type: String, enum: ['verify', 'revoke'], required: true },
  reason: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('VerificationLog', verificationLogSchema);
