const mongoose = require('mongoose');
const moderatorActionSchema = new mongoose.Schema({
  moderator: { type: mongoose.Schema.Types.ObjectId, ref: 'Moderator', required: true },
  action: { type: String, required: true },
  targetType: { type: String }, // e.g., 'post', 'user', 'report'
  targetId: { type: String },
  details: { type: Object },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ModeratorAction', moderatorActionSchema);
