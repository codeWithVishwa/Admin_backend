const auditLogController = require('../controllers/auditLog.controller');

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const moderatorController = require('../controllers/moderator.controller');
const adminAuth = require('../middleware/adminAuth');
const roleAuth = require('../middleware/roleAuth');
const moderatorAuthController = require('../controllers/moderatorAuth.controller');
const ModeratorAction = require('../models/moderatorAction.model');
const adminAuthcontroller=require('../controllers/adminAuth.controller')
const adminNotificationController = require('../controllers/adminNotification.controller');
const authAny = require('../middleware/authAny');
const adminVerifyLimiter = require('../middleware/adminVerifyLimiter');

// ------------------------------
// Public auth routes
// ------------------------------
// Admin login
router.post('/login', adminAuthcontroller.adminLogin);
// Admin logout
router.post('/logout', (req, res) => {
	res.clearCookie('admin_token', {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
	});
	res.json({ success: true, message: 'Admin logged out' });
});

// Moderator login (public)
router.post('/moderator/login', moderatorAuthController.moderatorLogin);
// Moderator refresh (public, uses refresh cookie)
router.post('/moderator/refresh', moderatorAuthController.refreshAccessToken);
// Moderator logout (public, clears refresh cookie)
router.post('/moderator/logout', moderatorAuthController.moderatorLogout);

// ------------------------------
// Protected routes
// ------------------------------
router.use(authAny);

// Overview stats
router.get('/stats', roleAuth(['admin', 'moderator']), adminController.getStats);

// Audit log endpoint (admin only)
router.get('/audit-logs', roleAuth(['admin']), auditLogController.getAuditLogs);
router.post(
  "/moderators/:id/revoke-sessions",
  roleAuth(['admin']),
  adminController.revokeModeratorSessions
);

// Admin can view all moderator actions
router.get('/moderator/actions', roleAuth(['admin']), async (req, res) => {
	const actions = await ModeratorAction.find().populate('moderator', 'name email').sort({ createdAt: -1 });
	res.json(actions);
});
// Moderator management (admin only)
router.post('/moderators', roleAuth(['admin']), moderatorController.createModerator);
router.get('/moderators', roleAuth(['admin']), moderatorController.getAllModerators);
// Ban / Unban moderators (admin only)
router.post(
  '/moderators/:id/ban',
  roleAuth(['admin']),
  adminController.banModerator
);

router.post(
  '/moderators/:id/unban',
  roleAuth(['admin']),
  adminController.unbanModerator
);
router.get(
  '/posts/:id/comments',
  roleAuth(['admin', 'moderator']),
  adminController.getCommentsForPost
);

router.delete('/comments/:id', roleAuth(['admin', 'moderator']), adminController.deleteComment);

// SESSION RESTORE - get current admin from cookie
router.get("/me", adminAuth, (req, res) => {
	if (!req.user) {
		return res.status(401).json({ message: "Not authenticated" });
	}

	res.json({
		_id: req.user._id,
		name: req.user.name,
		email: req.user.email,
		role: req.user.role,
	});
});








// Users
router.get('/users', roleAuth(['admin', 'moderator']), adminController.getAllUsers);
router.get('/users/:id', roleAuth(['admin', 'moderator']), adminController.getUserById);
router.post('/users/:id/ban', roleAuth(['admin']), adminController.banUser);
router.post('/users/:id/suspend', roleAuth(['admin', 'moderator']), adminController.suspendUser);
router.post('/users/:id/unban', roleAuth(['admin']), adminController.unbanUser);

// Verification (admin/superadmin only)
router.post('/verify-user', roleAuth(['admin', 'superadmin']), adminVerifyLimiter, adminController.verifyUser);
router.post('/revoke-verification', roleAuth(['admin', 'superadmin']), adminVerifyLimiter, adminController.revokeVerification);


// Posts
router.get('/posts', roleAuth(['admin', 'moderator']), adminController.getAllPosts);
router.get('/posts/:id', roleAuth(['admin', 'moderator']), adminController.getPostById);
router.post('/posts/:id/soft-delete', roleAuth(['admin', 'moderator']), adminController.softDeletePost);
router.delete('/posts/:id', roleAuth(['admin']), adminController.deletePost);



// Reports
router.get('/reports', roleAuth(['admin', 'moderator']), adminController.getAllReports);
router.get('/reports/latest', roleAuth(['admin', 'moderator']), adminController.getLatestReport);
router.get('/reports/:id', roleAuth(['admin', 'moderator']), adminController.getReportById);
router.post('/reports/:id/flag', roleAuth(['admin', 'moderator']), adminController.setReportFlag);
router.post('/reports/:id/notes', roleAuth(['admin', 'moderator']), adminController.addReportNote);
router.post('/reports/:id/resolve', roleAuth(['admin', 'moderator']), adminController.resolveReport);

// Admin notifications (admin only)
router.get('/notifications', roleAuth(['admin']), adminNotificationController.getAdminNotifications);
router.post('/notifications', roleAuth(['admin']), adminNotificationController.sendAdminNotification);

module.exports = router;
