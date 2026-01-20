const mongoose = require('mongoose');
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String },
    type: { type: String, enum: ['image', 'video'] },
    publicId: { type: String },
    width: { type: Number },
    height: { type: Number },
    durationSeconds: { type: Number },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Main Backend field
    caption: { type: String },
    // Legacy/older field used by AdminBackend UI
    content: { type: String },

    media: { type: [mediaSchema], default: [] },
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    commentCount: { type: Number, default: 0 },
    hideLikeCount: { type: Boolean, default: false },
    commentsDisabled: { type: Boolean, default: false },

    // Main Backend field
    isDelete: { type: Boolean, default: false },
    // Legacy/AdminBackend field
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);
module.exports = mongoose.model('Post', postSchema);
