const AuditLog = require('../models/auditLog.model');
const User = require('../models/user.model');
const Post = require('../models/post.model');
const Report = require('../models/report.model');
const Comment = require('../models/comment.model');
const Moderator = require("../models/moderator.model");
const VerificationLog = require('../models/verificationLog.model');

/* -------------------------------------------------------------
   STATS
----------------------------------------------------------------*/

exports.getStats = async (req, res) => {
  try {
    const [users, posts, postsDeleted, reportsOpen, reportsTotal] = await Promise.all([
      User.countDocuments({}),
      Post.countDocuments({}),
      Post.countDocuments({ $or: [{ isDeleted: true }, { isDelete: true }] }),
      Report.countDocuments({ status: 'open' }),
      Report.countDocuments({}),
    ]);

    res.json({
      users,
      posts,
      postsDeleted,
      reportsOpen,
      reportsTotal,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to load stats' });
  }
};

/* -------------------------------------------------------------
   USERS
----------------------------------------------------------------*/

// Get user by id
exports.getUserById = async (req, res) => {
  const user = await User.findById(
    req.params.id,
    'name email verified isVerified verificationType verifiedBy verifiedAt lastIp lastOnline lastActiveAt lastLoginAt status avatarUrl createdAt'
  ).populate('verifiedBy', 'name email');

  if (!user)
    return res.status(404).json({ error: 'User not found' });

  const u = user.toObject();
  if (!u.lastOnline && u.lastActiveAt) u.lastOnline = u.lastActiveAt;
  res.json(u);
};

// Search + List all users
exports.getAllUsers = async (req, res) => {
  const { q } = req.query;
  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);
  const usePaging = Number.isFinite(pageRaw) && pageRaw > 0;
  const page = usePaging ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;
  const skip = (page - 1) * limit;

  const filter = {};

  if (q) {
    const regex = new RegExp(q, 'i');
    filter.$or = [
      { name: regex },
      { email: regex }
    ];
  }

  const total = usePaging ? await User.countDocuments(filter) : null;

  let query = User.find(
    filter,
    'name email verified isVerified verificationType verifiedBy verifiedAt lastIp lastOnline lastActiveAt lastLoginAt status avatarUrl createdAt'
  ).sort({ createdAt: -1 });

  if (usePaging) query = query.skip(skip).limit(limit);

  const users = await query;

  const mapped = users.map((doc) => {
    const u = doc.toObject();
    if (!u.lastOnline && u.lastActiveAt) u.lastOnline = u.lastActiveAt;
    return u;
  });

  if (!usePaging) return res.json(mapped);

  const pages = Math.max(1, Math.ceil((total || 0) / limit));
  res.json({
    items: mapped,
    total: total || 0,
    page,
    limit,
    pages,
  });
};

// Ban user
exports.banUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user)
    return res.status(404).json({ error: 'User not found' });

  user.status = 'banned';
  await user.save();
  console.log("REQ.USER IN BAN:", req.user);
  await AuditLog.create({
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    role: req.user.role,

    action: 'ban user',
    targetType: 'user',
    targetId: user._id,
    targetName: user.name,
    targetEmail: user.email,

    reason: req.body.reason || '',
    notes: req.body.notes || ''
  });

  res.json({ success: true });
};

// Suspend
exports.suspendUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user)
    return res.status(404).json({ error: 'User not found' });

  user.status = 'suspended';
  await user.save();

  await AuditLog.create({
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    role: req.user.role,

    action: 'suspend user',
    targetType: 'user',
    targetId: user._id,
    targetName: user.name,
    targetEmail: user.email,

    reason: req.body.reason || '',
    notes: req.body.notes || ''
  });

  res.json({ success: true });
};

// Unban user
exports.unbanUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user)
    return res.status(404).json({ error: 'User not found' });

  user.status = 'active';
  await user.save();

  await AuditLog.create({
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    role: req.user.role,

    action: 'unban user',
    targetType: 'user',
    targetId: user._id,
    targetName: user.name,
    targetEmail: user.email,

    reason: req.body.reason || '',
    notes: req.body.notes || ''
  });

  res.json({ success: true });
};

/* -------------------------------------------------------------
   VERIFICATION (ADMIN ONLY)
----------------------------------------------------------------*/

const VERIFICATION_TYPES = new Set(['official', 'creator', 'developer']);

exports.verifyUser = async (req, res) => {
  try {
    const { userId, verificationType, reason } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!verificationType || !VERIFICATION_TYPES.has(String(verificationType))) {
      return res.status(400).json({ error: 'Invalid verificationType' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.status && user.status !== 'active') {
      return res.status(400).json({ error: 'Cannot verify a non-active user' });
    }

    user.isVerified = true;
    user.verificationType = String(verificationType);
    user.verifiedBy = req.user._id;
    user.verifiedAt = new Date();
    await user.save();

    await VerificationLog.create({
      userId: user._id,
      adminId: req.user._id,
      action: 'verify',
      reason: String(reason).trim(),
    });

    res.json({ success: true, userId: user._id, isVerified: true, verificationType: user.verificationType, verifiedAt: user.verifiedAt });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Verification failed' });
  }
};

exports.revokeVerification = async (req, res) => {
  try {
    const { userId, reason } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.isVerified = false;
    user.verificationType = null;
    user.verifiedBy = null;
    user.verifiedAt = null;
    await user.save();

    await VerificationLog.create({
      userId: user._id,
      adminId: req.user._id,
      action: 'revoke',
      reason: String(reason).trim(),
    });

    res.json({ success: true, userId: user._id, isVerified: false });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Revoke failed' });
  }
};



/* -------------------------------------------------------------
   POSTS
----------------------------------------------------------------*/

// Get post by id
exports.getPostById = async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate('author', 'name email');

  if (!post)
    return res.status(404).json({ error: 'Post not found' });

  res.json(post);
};

// Search + List posts
exports.getAllPosts = async (req, res) => {
  const { q, authorId } = req.query;
  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);
  const usePaging = Number.isFinite(pageRaw) && pageRaw > 0;
  const page = usePaging ? Math.floor(pageRaw) : 1;
  const safeLimit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : (usePaging ? 25 : 200);
  const skip = (page - 1) * safeLimit;

  const filter = {};

  if (authorId) filter.author = authorId;
  if (q) {
    const regex = new RegExp(q, 'i');
    filter.$or = [{ caption: regex }, { content: regex }];
  }

  const total = usePaging ? await Post.countDocuments(filter) : null;

  let query = Post.find(filter)
    .populate('author', 'name email')
    .sort({ createdAt: -1 });

  if (usePaging) query = query.skip(skip).limit(safeLimit);
  else query = query.limit(safeLimit);

  const posts = await query;

  if (!usePaging) return res.json(posts);

  const pages = Math.max(1, Math.ceil((total || 0) / safeLimit));
  res.json({
    items: posts,
    total: total || 0,
    page,
    limit: safeLimit,
    pages,
  });
};

// Soft delete post
exports.softDeletePost = async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate('author', 'name email');

  if (!post)
    return res.status(404).json({ error: 'Post not found' });

  // Maintain compatibility with both AdminBackend and main Backend flags
  post.isDeleted = true;
  post.isDelete = true;
  await post.save();

  await AuditLog.create({
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    role: req.user.role,

    action: 'soft delete post',
    targetType: 'post',
    targetId: post._id,
    targetName: post.author?.name || null,
    targetEmail: post.author?.email || null,

    reason: req.body.reason || '',
    notes: req.body.notes || ''
  });

  res.json({ success: true });
};

// Delete post permanently
exports.deletePost = async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate('author', 'name email');

  if (!post)
    return res.status(404).json({ error: 'Post not found' });

  await post.deleteOne();

  await AuditLog.create({
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    role: req.user.role,

    action: 'delete post',
    targetType: 'post',
    targetId: post._id,
    targetName: post.author?.name,
    targetEmail: post.author?.email,

    notes: req.body.notes || ''
  });

  res.json({ success: true });
};



/* -------------------------------------------------------------
   COMMENTS
----------------------------------------------------------------*/

// Get comments of a post
exports.getCommentsForPost = async (req, res) => {
  const postId = req.params.id;

  const post = await Post.findById(postId);
  if (!post)
    return res.status(404).json({ error: 'Post not found' });

  const comments = await Comment.find({ post: postId })
    .populate('author', 'name email avatarUrl')
    .sort({ createdAt: -1 });

  res.json(comments);
};

// Delete comment
exports.deleteComment = async (req, res) => {
  const comment = await Comment.findById(req.params.id)
    .populate('author', 'name email');

  if (!comment)
    return res.status(404).json({ error: 'Comment not found' });

  await comment.deleteOne();

  await AuditLog.create({
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    role: req.user.role,

    action: 'delete comment',
    targetType: 'comment',
    targetId: comment._id,
    targetName: comment.author?.name || null,
    targetEmail: comment.author?.email || null,

    notes: "Comment removed by admin/mod"
  });

  res.json({ success: true });
};



/* -------------------------------------------------------------
   REPORTS
----------------------------------------------------------------*/

// Get single report
exports.getReportById = async (req, res) => {
  const report = await Report.findById(req.params.id)
    .populate('reporter', 'name email')
    .populate('user', 'name email')
    .populate({ path: 'post', populate: { path: 'author', select: 'name email' } })
    .populate('reportedUser', 'name email');

  if (!report)
    return res.status(404).json({ error: 'Report not found' });

  const reporter = report.reporter || report.user;
  const post = report.post ? {
    _id: report.post._id,
    caption: report.post.caption || null,
    content: report.post.content || null,
    media: Array.isArray(report.post.media) ? report.post.media : [],
    visibility: report.post.visibility || null,
    isDeleted: Boolean(report.post.isDelete || report.post.isDeleted),
    createdAt: report.post.createdAt || null,
    author: report.post.author ? {
      _id: report.post.author._id,
      name: report.post.author.name,
      email: report.post.author.email,
    } : null,
  } : null;

  res.json({
    _id: report._id,
    targetType: report.targetType || 'post',
    reporter: reporter ? { _id: reporter._id, name: reporter.name, email: reporter.email } : null,
    reportedUser: report.reportedUser ? { _id: report.reportedUser._id, name: report.reportedUser.name, email: report.reportedUser.email } : null,
    post,
    reason: report.reason,
    status: report.status,
    flagged: !!report.flagged,
    flaggedAt: report.flaggedAt || null,
    flaggedByName: report.flaggedByName || null,
    flaggedByEmail: report.flaggedByEmail || null,
    adminNotes: Array.isArray(report.adminNotes) ? report.adminNotes : [],
    createdAt: report.createdAt || null,
    updatedAt: report.updatedAt || null,
  });
};

// Get latest open report (for quick moderation)
exports.getLatestReport = async (req, res) => {
  const filter = { status: 'open' };
  if (req.query.targetType && ['post', 'user'].includes(String(req.query.targetType))) {
    filter.targetType = String(req.query.targetType);
  }

  const report = await Report.findOne(filter)
    .populate('reporter', 'name email')
    .populate('user', 'name email')
    .populate({ path: 'post', populate: { path: 'author', select: 'name email' } })
    .populate('reportedUser', 'name email')
    .sort({ createdAt: -1 });

  if (!report) return res.json({ report: null });

  const reporter = report.reporter || report.user;
  res.json({
    report: {
      _id: report._id,
      targetType: report.targetType || 'post',
      reporterName: reporter?.name || null,
      reporterEmail: reporter?.email || null,
      reportedUserId: report.reportedUser?._id || null,
      reportedUserName: report.reportedUser?.name || null,
      reportedUserEmail: report.reportedUser?.email || null,
      postId: report.post?._id || null,
      postCaption: (report.post?.caption || report.post?.content || null),
      postAuthorName: report.post?.author?.name || null,
      postAuthorEmail: report.post?.author?.email || null,
      postDeleted: report.post ? Boolean(report.post.isDelete || report.post.isDeleted) : null,
      reason: report.reason,
      status: report.status,
      flagged: !!report.flagged,
      createdAt: report.createdAt || null,
    },
  });
};

// List all reports
exports.getAllReports = async (req, res) => {
  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);
  const usePaging = Number.isFinite(pageRaw) && pageRaw > 0;
  const page = usePaging ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 25;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.targetType && ['post', 'user'].includes(String(req.query.targetType))) {
    filter.targetType = String(req.query.targetType);
  }
  if (req.query.status && ['open', 'resolved'].includes(String(req.query.status))) {
    filter.status = String(req.query.status);
  }

  const total = usePaging ? await Report.countDocuments(filter) : null;

  let query = Report.find(filter)
    .populate('reporter', 'name email')
    .populate('user', 'name email')
    .populate({ path: 'post', populate: { path: 'author', select: 'name email' } })
    .populate('reportedUser', 'name email')
    .sort({ createdAt: -1 });

  if (usePaging) query = query.skip(skip).limit(limit);
  const reports = await query;

  const mapped = reports.map(r => {
    const reporter = r.reporter || r.user;
    const post = r.post;
    const postCaption = post?.caption || post?.content || '';

    return {
      _id: r._id,
      targetType: r.targetType || 'post',
      reporterName: reporter?.name || null,
      reporterEmail: reporter?.email || null,

      reportedUserName: r.reportedUser?.name || null,
      reportedUserEmail: r.reportedUser?.email || null,
      reportedUserId: r.reportedUser?._id || null,

      postId: post?._id || null,
      postCaption: postCaption ? String(postCaption).slice(0, 140) : null,
      postAuthorName: post?.author?.name || null,
      postAuthorEmail: post?.author?.email || null,
      postDeleted: post ? Boolean(post.isDelete || post.isDeleted) : null,
      postCreatedAt: post?.createdAt || null,
      postMediaCount: Array.isArray(post?.media) ? post.media.length : 0,

      reason: r.reason,
      status: r.status,
      flagged: !!r.flagged,
      notesCount: Array.isArray(r.adminNotes) ? r.adminNotes.length : 0,
      lastNotePreview: Array.isArray(r.adminNotes) && r.adminNotes.length ? String(r.adminNotes[r.adminNotes.length - 1].note || '').slice(0, 80) : null,
      createdAt: r.createdAt || null,
    };
  });

  if (!usePaging) return res.json(mapped);

  const pages = Math.max(1, Math.ceil((total || 0) / limit));
  res.json({
    items: mapped,
    total: total || 0,
    page,
    limit,
    pages,
  });
};

// Flag/unflag report for later review
exports.setReportFlag = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });

  const nextFlagged = typeof req.body.flagged === 'boolean' ? req.body.flagged : !report.flagged;
  report.flagged = nextFlagged;
  report.flaggedAt = nextFlagged ? new Date() : null;
  report.flaggedById = nextFlagged ? req.user._id : null;
  report.flaggedByName = nextFlagged ? req.user.name : null;
  report.flaggedByEmail = nextFlagged ? req.user.email : null;
  await report.save();

  await AuditLog.create({
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    role: req.user.role,

    action: nextFlagged ? 'flag report' : 'unflag report',
    targetType: 'report',
    targetId: report._id,
    notes: req.body.notes || '',
  });

  res.json({ success: true, flagged: report.flagged, flaggedAt: report.flaggedAt || null });
};

// Add an admin/moderator note to a report
exports.addReportNote = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });

  const note = String(req.body.note || '').trim();
  if (!note) return res.status(400).json({ error: 'Note is required' });
  if (note.length > 2000) return res.status(400).json({ error: 'Note too long' });

  report.adminNotes = Array.isArray(report.adminNotes) ? report.adminNotes : [];
  report.adminNotes.push({
    byId: req.user._id,
    byName: req.user.name,
    byEmail: req.user.email,
    role: req.user.role,
    note,
  });
  await report.save();

  await AuditLog.create({
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    role: req.user.role,

    action: 'add report note',
    targetType: 'report',
    targetId: report._id,
    notes: note.slice(0, 500),
  });

  res.json({ success: true, notesCount: report.adminNotes.length });
};

// Resolve report
exports.resolveReport = async (req, res) => {
  const report = await Report.findById(req.params.id)
    .populate('reporter', 'name email')
    .populate('user', 'name email');

  if (!report)
    return res.status(404).json({ error: 'Report not found' });

  report.status = "resolved";
  await report.save();

  const reporter = report.reporter || report.user;
  await AuditLog.create({
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    role: req.user.role,

    action: 'resolve report',
    targetType: 'report',
    targetId: report._id,
    targetName: reporter?.name || null,
    targetEmail: reporter?.email || null,

    notes: req.body.notes || ''
  });

  res.json({ success: true });
};



/* -------------------------------------------------------------
   MODERATORS
----------------------------------------------------------------*/

// Revoke moderator sessions
exports.revokeModeratorSessions = async (req, res) => {
  try {
    const mod = await Moderator.findById(req.params.id);
    if (!mod)
      return res.status(404).json({ error: "Moderator not found" });

    mod.refreshTokens = [];
    await mod.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      role: "admin",

      action: "revoke sessions",
      targetType: "moderator",
      targetId: mod._id,
      targetName: mod.name,
      targetEmail: mod.email,

      notes: `All sessions cleared`
    });

    res.json({ success: true });
  } catch (err) {
    console.error("revokeModeratorSessions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Ban moderator
exports.banModerator = async (req, res) => {
  try {
    const mod = await Moderator.findById(req.params.id);
    if (!mod)
      return res.status(404).json({ error: 'Moderator not found' });

    if (mod.status === 'banned')
      return res.status(400).json({ error: 'Moderator already banned' });

    mod.status = 'banned';
    mod.refreshTokens = [];
    await mod.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      role: 'admin',

      action: 'ban moderator',
      targetType: 'moderator',
      targetId: mod._id,
      targetName: mod.name,
      targetEmail: mod.email,

      notes: `Moderator banned`
    });

    res.json({ success: true });
  } catch (err) {
    console.error("banModerator error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Unban moderator
exports.unbanModerator = async (req, res) => {
  try {
    const mod = await Moderator.findById(req.params.id);
    if (!mod)
      return res.status(404).json({ error: 'Moderator not found' });

    if (mod.status !== 'banned')
      return res.status(400).json({ error: 'Moderator is not banned' });

    mod.status = 'active';
    await mod.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      role: 'admin',

      action: 'unban moderator',
      targetType: 'moderator',
      targetId: mod._id,
      targetName: mod.name,
      targetEmail: mod.email,

      notes: `Moderator unbanned`
    });

    res.json({ success: true });
  } catch (err) {
    console.error("unbanModerator error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

