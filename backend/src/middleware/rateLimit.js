const requestCounts = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requestCounts.entries()) {
    const valid = timestamps.filter(t => now - t < WINDOW_MS);
    if (valid.length === 0) {
      requestCounts.delete(key);
    } else {
      requestCounts.set(key, valid);
    }
  }
}, 5 * 60 * 1000);

export function rateLimit(req, res, next) {
  const key = req.user?.id || req.ip;
  const now = Date.now();

  if (!requestCounts.has(key)) {
    requestCounts.set(key, []);
  }

  const timestamps = requestCounts.get(key);
  const windowStart = now - WINDOW_MS;
  const recentRequests = timestamps.filter(t => t > windowStart);

  if (recentRequests.length >= MAX_REQUESTS) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  recentRequests.push(now);
  requestCounts.set(key, recentRequests);
  next();
}
