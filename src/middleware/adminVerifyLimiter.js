const ACTION_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ACTION_MAX_PER_HOUR = 30;
const BURST_WINDOW_MS = 60 * 1000; // 1 minute
const ACTION_MAX_PER_MIN = 5;
const UNIQUE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const UNIQUE_MAX_PER_HOUR = 20;

const actionMap = new Map(); // adminId -> timestamps[]
const burstMap = new Map(); // adminId -> timestamps[]
const uniqueMap = new Map(); // adminId -> Map(userId -> timestamp)

function prune(list, windowMs, now) {
  while (list.length && now - list[0] > windowMs) list.shift();
}

module.exports = function adminVerifyLimiter(req, res, next) {
  const adminId = String(req.user?._id || '');
  if (!adminId) return res.status(401).json({ error: 'Not authenticated' });

  const now = Date.now();
  const actions = actionMap.get(adminId) || [];
  prune(actions, ACTION_WINDOW_MS, now);
  if (actions.length >= ACTION_MAX_PER_HOUR) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }

  const bursts = burstMap.get(adminId) || [];
  prune(bursts, BURST_WINDOW_MS, now);
  if (bursts.length >= ACTION_MAX_PER_MIN) {
    return res.status(429).json({ error: 'Too many verification actions. Slow down.' });
  }

  const userId = String(req.body?.userId || '');
  if (userId) {
    const userMap = uniqueMap.get(adminId) || new Map();
    // prune old entries
    for (const [id, ts] of userMap.entries()) {
      if (now - ts > UNIQUE_WINDOW_MS) userMap.delete(id);
    }
    if (!userMap.has(userId) && userMap.size >= UNIQUE_MAX_PER_HOUR) {
      return res.status(429).json({ error: 'Verification limit reached. Try again later.' });
    }
    userMap.set(userId, now);
    uniqueMap.set(adminId, userMap);
  }

  actions.push(now);
  bursts.push(now);
  actionMap.set(adminId, actions);
  burstMap.set(adminId, bursts);

  next();
};
