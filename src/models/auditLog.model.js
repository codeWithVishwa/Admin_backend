const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  actorName: { type: String },     // NEW
  actorEmail: { type: String },    // NEW

  role: { type: String, enum: ["admin", "moderator"], required: true },

  action: { type: String, required: true },

  targetType: { 
    type: String, 
    enum: ["user", "post", "report", "moderator", "comment"], 
    required: true 
  },

  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetName: { type: String },    // NEW
  targetEmail: { type: String },   // NEW

  reason: { type: String },
  notes: { type: String },

  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("AuditLog", auditLogSchema);

