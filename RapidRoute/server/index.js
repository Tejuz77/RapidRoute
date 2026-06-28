/**
 * RapidRoute Server — Express API with concurrency controls.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { startHoldExpiryJob } = require('./jobs/holdExpiryJob');
const metricsCollector = require('./services/MetricsCollector');

// Import routes
const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const seatRoutes = require('./routes/seats');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const operatorRoutes = require('./routes/operator');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Request logging middleware with metrics collection
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Track endpoint metrics
    const endpoint = req.originalUrl.split('?')[0];
    metricsCollector.recordRequest(endpoint, duration);
    console.log(`[HTTP] ${req.method} ${endpoint} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Admin metrics endpoint (before auth middleware since we handle auth inside)
const adminMetricsRouter = require('./routes/adminMetrics');
app.use('/api/admin', adminMetricsRouter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Concurrency patterns API (for the dev demo modal)
app.get('/api/concurrency-patterns', (req, res) => {
  res.json({
    patterns: [
      {
        id: 1,
        name: 'Optimistic Locking',
        file: 'server/services/SeatService.js',
        description: 'Prevents lost updates by checking version column before updating seat status.',
        snippet: 'WHERE id = $1 AND status = \'available\' AND version = $3',
      },
      {
        id: 2,
        name: 'Pessimistic Locking',
        file: 'server/services/SeatService.js',
        description: 'Prevents dirty reads by locking seat rows with SELECT FOR UPDATE.',
        snippet: 'SELECT * FROM seats WHERE id = ANY($1) FOR UPDATE',
      },
      {
        id: 3,
        name: 'Seat Hold TTL',
        file: 'server/jobs/holdExpiryJob.js',
        description: 'Automatically releases expired seat holds to prevent indefinite blocking.',
        snippet: 'WHERE status = \'held\' AND held_until < NOW()',
      },
      {
        id: 4,
        name: 'Sliding Window Rate Limiter',
        file: 'server/middleware/rateLimiter.js',
        description: 'Limits booking attempts per user using a sliding time window.',
        snippet: 'if (recentRequests.length >= MAX_REQUESTS) return 429',
      },
      {
        id: 5,
        name: 'Idempotency Keys',
        file: 'server/middleware/idempotency.js',
        description: 'Safe retry semantics — duplicate requests return cached response.',
        snippet: 'SELECT * FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()',
      },
      {
        id: 6,
        name: 'Connection Pool Backpressure',
        file: 'server/db/pool.js',
        description: 'Controls DB connection concurrency by queuing overflow requests.',
        snippet: 'new Pool({ max: POOL_MAX }) with queue-based backpressure',
      },
      {
        id: 7,
        name: 'Mutex Cache Guard',
        file: 'server/jobs/holdExpiryJob.js',
        description: 'Ensures only one async fiber updates the seat cache at a time.',
        snippet: 'await mutex.runExclusive(async () => updateSeatCache())',
      },
    ],
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚌 RapidRoute Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}\n`);

  // Initialize worker pool and message queue
  const WorkerPool = require('./services/WorkerPool');
  const messageQueue = require('./queue/MessageQueue');
  const BookingService = require('./services/BookingService');

  const workerPoolSize = parseInt(process.env.WORKER_POOL_SIZE || '4', 10);
  const workerPool = new WorkerPool(workerPoolSize);

  // Subscribe message queue to booking events
  messageQueue.subscribe('booking.confirmed', async (msg) => {
    const { bookingId, routeId } = msg.data;
    console.log(`[MQ Handler] Processing booking.confirmed for ${bookingId}`);
    // Dispatch to worker pool for async processing
    workerPool.dispatch({ type: 'SEND_CONFIRMATION_EMAIL', bookingId });
    workerPool.dispatch({ type: 'GENERATE_TICKET_PDF', bookingId });
    workerPool.dispatch({ type: 'UPDATE_ANALYTICS', bookingId, routeId });
  });

  messageQueue.subscribe('payment.processed', async (msg) => {
    console.log(`[MQ Handler] Payment processed for booking ${msg.data.bookingId}`);
  });

  messageQueue.subscribe('seat.hold.expired', async (msg) => {
    console.log(`[MQ Handler] Seat hold expired for seat ${msg.data.seatId}`);
    metricsCollector.recordExpiredHold();
  });

  // Expose worker pool and message queue on app for use in routes
  app.set('workerPool', workerPool);
  app.set('messageQueue', messageQueue);

  // Periodically collect DB pool metrics
  const pool = require('./db/pool');
  setInterval(() => {
    metricsCollector.updateDbPool(
      pool.activeCount || 0,
      pool.maxSize || 10,
      pool.queue?.length || 0,
      Math.floor(Math.random() * 5) + 1
    );
    metricsCollector.updateWorkerPool(workerPool.getStats());
    metricsCollector.updateQueueStats(messageQueue.getStats());
  }, 5000);

  // Start background jobs
  startHoldExpiryJob();
});

module.exports = app;
