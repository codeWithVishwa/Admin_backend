const AuditLog = require('../models/auditLog.model');

// List all audit logs (admin only)
exports.getAuditLogs = async (req, res) => {
  const logs = await AuditLog.find().sort({ timestamp: -1 });
  res.json(logs);
};

