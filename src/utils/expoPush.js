const { Expo } = require('expo-server-sdk');

const expo = new Expo();

function isValidToken(token) {
  return Expo.isExpoPushToken(token);
}

async function sendPushNotification(pushToken, title, body, data = {}, options = {}) {
  if (!pushToken || !isValidToken(pushToken)) return;

  const ttlSeconds = 60 * 60 * 24; // 24h

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
    channelId: 'chat-messages',
    ...(options.collapseId ? { collapseId: options.collapseId } : {}),
    ...(options.threadId ? { threadId: options.threadId } : {}),
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.image ? { image: options.image } : {}),
    ttl: ttlSeconds,
    expiration: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const chunks = expo.chunkPushNotifications([message]);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const t of tickets) {
        if (t.status === 'error') {
          console.error('[admin push] ticket error:', t.message, t.details || {});
        }
      }
    } catch (e) {
      console.error('[admin push] send failed:', e?.message || e);
    }
  }
}

module.exports = {
  sendPushNotification,
};
