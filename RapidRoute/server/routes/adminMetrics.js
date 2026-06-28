/**
 * Admin Metrics Route — Real-time performance and reliability metrics.
 *
 * GET /api/admin/metrics returns all tracked metrics from MetricsCollector,
 * including request throughput, DB pool stats, worker pool stats, seat holds,
 * rate limiter blocks, idempotency stats, AI assistant stats, concurrency events,
 * and message queue stats.
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const metricsCollector = require('../services/MetricsCollector');

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/admin/metrics
 * Returns all current system metrics for the Performance dashboard.
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = metricsCollector.getAllMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('[AdminMetrics] Error fetching metrics:', error.message);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

module.exports = router;
