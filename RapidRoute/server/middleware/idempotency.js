/**
 * Idempotency guard: safe retry semantics for non-idempotent operations.
 *
 * Before processing any request, checks the idempotency_keys table.
 * - If key exists and not expired: returns cached response immediately
 *   without processing (safe retry).
 * - If key does not exist: processes request, then stores response with
 *   expires_at = NOW() + 24 hours.
 */

const pool = require('../db/pool');

/**
 * Middleware to enforce idempotency via idempotency-key header.
 * Used on booking and payment endpoints to prevent duplicate processing.
 */
async function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return res.status(400).json({
      error: 'Missing idempotency-key header',
      message: 'This endpoint requires an idempotency key for safe retry semantics.',
    });
  }

  try {
    // Check if key already exists and is valid
    const existing = await pool.query(
      'SELECT * FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()',
      [idempotencyKey]
    );

    if (existing.rows.length > 0) {
      // Key exists and is valid — return cached response
      const cached = existing.rows[0];
      console.log(`[Idempotency] Cache hit for key: ${idempotencyKey}`);
      return res.status(200).json(cached.response_body);
    }

    // Store original json function to intercept the response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Store the response in idempotency_keys table (fire and forget)
      pool
        .query(
          `INSERT INTO idempotency_keys (key, response_body, expires_at)
           VALUES ($1, $2::jsonb, NOW() + INTERVAL '24 hours')
           ON CONFLICT (key) DO NOTHING`,
          [idempotencyKey, JSON.stringify(body)]
        )
        .catch((err) => {
          console.error('[Idempotency] Failed to cache response:', err.message);
        });

      return originalJson(body);
    };

    next();
  } catch (error) {
    console.error('[Idempotency] Error:', error);
    return res.status(500).json({ error: 'Idempotency check failed' });
  }
}

module.exports = idempotencyMiddleware;
