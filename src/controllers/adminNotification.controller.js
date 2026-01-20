const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const { sendPushNotification } = require('../utils/expoPush');

function normalizeIds(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  return [input].filter(Boolean);
}

async function sendAdminNotification(req, res) {
  try {
    const { userId, userIds, title, message, data, sendPush = true } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ message: 'title and message are required' });
    }

    const targets = normalizeIds(userIds?.length ? userIds : userId);

    let recipients;
    if (targets.length) {
      recipients = await User.find({ _id: { $in: targets } }).select('_id pushToken status');
    } else {
      // Broadcast to active users
      recipients = await User.find({ status: 'active' }).select('_id pushToken status');
    }

    if (!recipients.length) {
      return res.status(404).json({ message: 'No recipients found' });
    }

    // Create Notification docs
    const docs = recipients.map((u) => ({
      user: u._id,
      actor: null,
      type: 'admin',
      metadata: {
        title,
        message,
        ...(data && typeof data === 'object' ? { data } : {}),
      },
      readAt: null,
    }));

    await Notification.insertMany(docs, { ordered: false }).catch(() => {});

    if (sendPush) {
      // Best-effort pushes (collapse per-admin broadcast title)
      await Promise.all(
        recipients.map(async (u) => {
          if (!u.pushToken) return;
          await sendPushNotification(
            u.pushToken,
            title,
            message,
            {
              type: 'admin',
              title,
              message,
              ...(data && typeof data === 'object' ? data : {}),
            },
            {
              collapseId: `admin:${String(u._id)}:${String(title).slice(0, 32)}`,
              threadId: `admin:${String(u._id)}`,
            }
          );
        })
      );
    }

    return res.json({ ok: true, sent: recipients.length });
  } catch (e) {
    return res.status(500).json({ message: e?.message || 'Failed to send notification' });
  }
}

async function getAdminNotifications(req, res) {
  try {
    const { userId } = req.query || {};
    const limitRaw = req.query?.limit;
    const limit = Math.min(200, Math.max(1, Number(limitRaw) || 50));

    const query = { type: 'admin' };
    if (userId) query.user = userId;

    const rows = await Notification.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ message: e?.message || 'Failed to load notifications' });
  }
}

module.exports = {
  sendAdminNotification,
  getAdminNotifications,
};
