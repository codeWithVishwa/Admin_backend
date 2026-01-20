const mongoose = require('mongoose');

const reportNoteSchema = new mongoose.Schema(
  {
    byId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    byName: { type: String },
    byEmail: { type: String },
    role: { type: String, enum: ['admin', 'moderator'] },
    note: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    // Legacy field (older builds used `user` for reporter)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Current field (main Backend)
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    targetType: { type: String, enum: ['post', 'user'], default: 'post' },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    reason: { type: String, default: 'inappropriate' },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },

    flagged: { type: Boolean, default: false },
    flaggedAt: { type: Date, default: null },
    flaggedById: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    flaggedByName: { type: String, default: null },
    flaggedByEmail: { type: String, default: null },

    adminNotes: { type: [reportNoteSchema], default: [] },
  },
  { timestamps: true }
);
module.exports = mongoose.model('Report', reportSchema);
