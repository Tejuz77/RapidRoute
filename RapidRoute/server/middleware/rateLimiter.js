/**
 * Sliding window rate limiter — synchronizes request flow per user.
 *
 * Tracks request timestamps per user in memory. If a user exceeds the
 * configured limit within the sliding window, returns 429 with Retry-After
 * header and does not process the request.
 */

const requestLogs = new Map(); // userId/IP -> [timestamps]

const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '5', 10);
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

/**
 * Clean up expired entries from a user's request log.
 */
function cleanExpired(timestamps) {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const filtered = timestamps.filter((ts) => ts > cutoff);
  return filtered;
}

/**
 * Sliding window rate limiter middleware.
 * Limits to MAX_REQUESTS requests per WINDOW_MS per user (or IP if unauthenticated).
 */
function rateLimiter(req, res, next) {
  const userId = req.user?.id || req.ip;
  const now = Date.now();

  if (!requestLogs.has(userId)) {
    requestLogs.set(userId, []);
  }

  const timestamps = requestLogs.get(userId);
  const recentRequests = cleanExpired(timestamps);

  if (recentRequests.length >= MAX_REQUESTS) {
    const oldestRequest = recentRequests[0];
    const retryAfter = Math.ceil((oldestRequest + WINDOW_MS - now) / 1000);

    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many requests. Please slow down.',
      retryAfter,
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
    });
  }

  recentRequests.push(now);
  requestLogs.set(userId, recentRequests);

  next();
}

/**
 * Clean up stale entries periodically (every 5 minutes).
 */
setInterval(() => {
  for (const [key, timestamps] of requestLogs.entries()) {
    const cleaned = cleanExpired(timestamps);
    if (cleaned.length === 0) {
      requestLogs.delete(key);
    } else {
      requestLogs.set(key, cleaned);
    }
  }
}, 300000);

module.exports = rateLimiter;
