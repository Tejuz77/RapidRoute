/**
 * Metrics Collector — Real-time performance and reliability metrics.
 *
 * Tracks: request throughput, DB pool stats, worker pool stats,
 * seat hold stats, rate limiter blocks, idempotency cache hits/misses,
 * AI assistant queries, and concurrency events.
 */

const RETENTION_MS = parseInt(process.env.METRICS_RETENTION_SECONDS || '60', 10) * 1000;

class MetricsCollector {
  constructor() {
    this.metrics = {
      requestThroughput: {},      // { endpoint: [{ timestamp, durationMs }] }
      dbPool: {
        activeConnections: 0,
        maxConnections: 10,
        queueDepth: 0,
        avgQueryTimeMs: 0,
        totalQueries: 0,
        totalQueryTimeMs: 0,
      },
      rateLimiter: {
        blockedRequests: [],       // [{ timestamp, userId, email, endpoint, retryAfter }]
      },
      idempotency: {
        hits: 0,
        misses: 0,
        hourStartTime: Date.now(),
      },
      seatHolds: {
        currentHeld: 0,
        expiredLastMinute: 0,
      },
      aiAssistant: {
        totalQueries: 0,
        totalResponseTimeMs: 0,
        errors: 0,
      },
      concurrencyEvents: [],      // [{ timestamp, type, details }]
      queueStats: {
        published: 0,
        consumed: 0,
        deadLettered: 0,
      },
      workerPool: {
        activeWorkers: 0,
        totalWorkers: 4,
        queueDepth: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
      },
    };

    // Cleanup old metrics every 30 seconds
    setInterval(() => this._cleanup(), 30000);
  }

  /**
   * Clean up expired metric entries.
   */
  _cleanup() {
    const cutoff = Date.now() - RETENTION_MS;

    // Clean request throughput
    for (const endpoint of Object.keys(this.metrics.requestThroughput)) {
      this.metrics.requestThroughput[endpoint] = this.metrics.requestThroughput[endpoint].filter(
        (entry) => entry.timestamp > cutoff
      );
      if (this.metrics.requestThroughput[endpoint].length === 0) {
        delete this.metrics.requestThroughput[endpoint];
      }
    }

    // Clean rate limiter blocks
    this.metrics.rateLimiter.blockedRequests = this.metrics.rateLimiter.blockedRequests.filter(
      (entry) => entry.timestamp > cutoff
    );

    // Clean concurrency events (keep last 200)
    if (this.metrics.concurrencyEvents.length > 200) {
      this.metrics.concurrencyEvents = this.metrics.concurrencyEvents.slice(-200);
    }

    // Reset expired last minute counter
    this.metrics.seatHolds.expiredLastMinute = 0;

    // Reset idempotency hour stats if past hour
    if (Date.now() - this.metrics.idempotency.hourStartTime > 3600000) {
      this.metrics.idempotency.hits = 0;
      this.metrics.idempotency.misses = 0;
      this.metrics.idempotency.hourStartTime = Date.now();
    }
  }

  /**
   * Record a request with its duration.
   */
  recordRequest(endpoint, durationMs) {
    if (!this.metrics.requestThroughput[endpoint]) {
      this.metrics.requestThroughput[endpoint] = [];
    }
    this.metrics.requestThroughput[endpoint].push({
      timestamp: Date.now(),
      durationMs,
    });
  }

  /**
   * Update DB pool stats.
   */
  updateDbPool(activeConnections, maxConnections, queueDepth, queryTimeMs) {
    this.metrics.dbPool.activeConnections = activeConnections;
    this.metrics.dbPool.maxConnections = maxConnections;
    this.metrics.dbPool.queueDepth = queueDepth;
    this.metrics.dbPool.totalQueries++;
    this.metrics.dbPool.totalQueryTimeMs += queryTimeMs;
    this.metrics.dbPool.avgQueryTimeMs = Math.round(
      this.metrics.dbPool.totalQueryTimeMs / this.metrics.dbPool.totalQueries
    );
  }

  /**
   * Record a rate limit block.
   */
  recordRateLimitBlock(userId, email, endpoint, retryAfter) {
    this.metrics.rateLimiter.blockedRequests.push({
      timestamp: Date.now(),
      userId,
      email,
      endpoint,
      retryAfter,
    });
  }

  /**
   * Record an idempotency cache hit or miss.
   */
  recordIdempotency(hit) {
    if (hit) {
      this.metrics.idempotency.hits++;
    } else {
      this.metrics.idempotency.misses++;
    }
  }

  /**
   * Update seat hold stats.
   */
  updateSeatHolds(currentHeld) {
    this.metrics.seatHolds.currentHeld = currentHeld;
  }

  /**
   * Record seat hold expiry.
   */
  recordExpiredHold() {
    this.metrics.seatHolds.expiredLastMinute++;
  }

  /**
   * Record an AI assistant query.
   */
  recordAiQuery(responseTimeMs, success) {
    this.metrics.aiAssistant.totalQueries++;
    this.metrics.aiAssistant.totalResponseTimeMs += responseTimeMs;
    if (!success) {
      this.metrics.aiAssistant.errors++;
    }
  }

  /**
   * Record a concurrency event for the timeline.
   */
  recordConcurrencyEvent(type, details) {
    this.metrics.concurrencyEvents.push({
      timestamp: Date.now(),
      type,
      details,
    });

    // Keep max 200 events
    if (this.metrics.concurrencyEvents.length > 200) {
      this.metrics.concurrencyEvents.shift();
    }
  }

  /**
   * Update worker pool stats.
   */
  updateWorkerPool(stats) {
    Object.assign(this.metrics.workerPool, stats);
  }

  /**
   * Update queue stats.
   */
  updateQueueStats(stats) {
    Object.assign(this.metrics.queueStats, stats);
  }

  /**
   * Get all current metrics.
   */
  getAllMetrics() {
    const now = Date.now();
    const throughput = {};

    // Calculate requests per second per endpoint over the last 60 seconds
    for (const [endpoint, entries] of Object.entries(this.metrics.requestThroughput)) {
      const recent = entries.filter((e) => e.timestamp > now - 60000);
      throughput[endpoint] = recent.length / 60; // req/sec
    }

    // Calculate idempotency cache hit rate
    const totalIdempotency = this.metrics.idempotency.hits + this.metrics.idempotency.misses;
    const cacheHitRate = totalIdempotency > 0
      ? Math.round((this.metrics.idempotency.hits / totalIdempotency) * 100)
      : 0;

    // Calculate AI assistant avg response time
    const aiAvgResponse = this.metrics.aiAssistant.totalQueries > 0
      ? Math.round(this.metrics.aiAssistant.totalResponseTimeMs / this.metrics.aiAssistant.totalQueries)
      : 0;

    // Build last 60 seconds of request history for chart (sampled every second)
    const requestHistory = [];
    for (let i = 59; i >= 0; i--) {
      const secondStart = now - (i + 1) * 1000;
      const secondEnd = now - i * 1000;
      const historyPoint = { timestamp: secondStart };

      for (const [endpoint, entries] of Object.entries(this.metrics.requestThroughput)) {
        const count = entries.filter((e) => e.timestamp >= secondStart && e.timestamp < secondEnd).length;
        historyPoint[endpoint.replace(/^\/api\//, '')] = count;
      }

      requestHistory.push(historyPoint);
    }

    return {
      throughput,
      requestHistory,
      dbPool: { ...this.metrics.dbPool },
      rateLimiter: {
        totalBlocked: this.metrics.rateLimiter.blockedRequests.length,
        recentBlocks: this.metrics.rateLimiter.blockedRequests.slice(-20).reverse(),
      },
      idempotency: {
        hits: this.metrics.idempotency.hits,
        misses: this.metrics.idempotency.misses,
        cacheHitRate,
      },
      seatHolds: { ...this.metrics.seatHolds },
      aiAssistant: {
        totalQueries: this.metrics.aiAssistant.totalQueries,
        avgResponseTimeMs: aiAvgResponse,
        errors: this.metrics.aiAssistant.errors,
      },
      concurrencyEvents: this.metrics.concurrencyEvents.slice(-50).reverse(),
      workerPool: { ...this.metrics.workerPool },
      queueStats: { ...this.metrics.queueStats },
    };
  }
}

// Singleton instance
const metricsCollector = new MetricsCollector();

module.exports = metricsCollector;
