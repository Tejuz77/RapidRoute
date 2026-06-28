/**
 * Admin routes — monitoring, operators management, and settings.
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const pool = require('../db/pool');
const RefundService = require('../services/RefundService');

const router = express.Router();

/**
 * Middleware to verify admin role.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.use(authMiddleware);
router.use(requireAdmin);

// ============================================================
// BOOKINGS
// ============================================================

/**
 * GET /api/admin/bookings
 * List all bookings with user and route details.
 */
router.get('/bookings', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.id,
        b.total_fare,
        b.status,
        b.created_at,
        b.seat_ids,
        b.passenger_names,
        u.name AS user_name,
        u.email AS user_email,
        oc.name AS origin_city,
        dc.name AS destination_city,
        bus.name AS bus_name,
        r.departure_time,
        r.travel_date
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN routes r ON b.route_id = r.id
      JOIN cities oc ON r.origin_city_id = oc.id
      JOIN cities dc ON r.destination_city_id = dc.id
      JOIN buses bus ON r.bus_id = bus.id
      ORDER BY b.created_at DESC
      LIMIT 50
    `);

    res.json({ bookings: result.rows });
  } catch (error) {
    console.error('[Admin] Bookings error:', error.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ============================================================
// BUSES
// ============================================================

/**
 * GET /api/admin/buses
 * List all buses with utilization stats.
 */
router.get('/buses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.id,
        b.name,
        b.bus_number,
        b.type,
        b.total_seats,
        b.amenities,
        b.status,
        b.cancelled_from,
        b.cancelled_until,
        b.operator_id,
        u.name AS operator_name,
        u.email AS operator_email,
        COUNT(DISTINCT r.id) AS active_routes,
        COUNT(DISTINCT r.id) FILTER (WHERE r.travel_date >= CURRENT_DATE) AS upcoming_routes,
        (
          SELECT COUNT(*) FROM seats s
          JOIN routes r2 ON s.route_id = r2.id
          WHERE r2.bus_id = b.id AND s.status = 'booked'
        ) AS booked_seats,
        (
          SELECT COUNT(*) FROM seats s
          JOIN routes r2 ON s.route_id = r2.id
          WHERE r2.bus_id = b.id AND s.status = 'held'
        ) AS held_seats
      FROM buses b
      LEFT JOIN routes r ON r.bus_id = b.id
      LEFT JOIN users u ON b.operator_id = u.id
      GROUP BY b.id, b.name, b.bus_number, b.type, b.total_seats, b.amenities, b.status,
               b.cancelled_from, b.cancelled_until, b.operator_id, u.name, u.email
      ORDER BY b.name
    `);

    const buses = result.rows.map((bus) => ({
      ...bus,
      occupancy_percentage:
        bus.total_seats > 0
          ? Math.round(
              ((bus.booked_seats + bus.held_seats) /
                (bus.active_routes * bus.total_seats || 1)) *
                100
            )
          : 0,
    }));

    res.json({ buses });
  } catch (error) {
    console.error('[Admin] Buses error:', error.message);
    res.status(500).json({ error: 'Failed to fetch buses' });
  }
});

// ============================================================
// OPERATORS
// ============================================================

/**
 * GET /api/admin/operators
 * List all operators.
 */
router.get('/operators', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.phone, u.created_at,
        (SELECT COUNT(*) FROM buses b WHERE b.operator_id = u.id) AS total_buses,
        (SELECT COUNT(*) FROM buses b WHERE b.operator_id = u.id AND b.status = 'active') AS active_buses,
        (SELECT COALESCE(SUM(bs.amount_paid), 0)::float FROM bus_subscriptions bs WHERE bs.operator_id = u.id) AS total_subscription_revenue
      FROM users u
      WHERE u.role = 'operator'
      ORDER BY u.name
    `);
    res.json({ operators: result.rows });
  } catch (error) {
    console.error('[Admin] Operators error:', error.message);
    res.status(500).json({ error: 'Failed to fetch operators' });
  }
});

/**
 * GET /api/admin/operators/:id/buses
 * List all buses for a specific operator (admin view).
 */
router.get('/operators/:id/buses', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, 
        (SELECT COUNT(*) FROM routes r WHERE r.bus_id = b.id) AS total_routes,
        (SELECT COUNT(*) FROM routes r WHERE r.bus_id = b.id AND r.travel_date >= CURRENT_DATE) AS upcoming_routes,
        (SELECT COUNT(*) FROM seats s JOIN routes r2 ON s.route_id = r2.id WHERE r2.bus_id = b.id AND s.status = 'booked') AS booked_seats,
        (SELECT COUNT(*) FROM seats s JOIN routes r2 ON s.route_id = r2.id WHERE r2.bus_id = b.id AND s.status = 'held') AS held_seats,
        bus_sub.status AS subscription_status,
        bus_sub.end_date AS subscription_end_date
      FROM buses b
      LEFT JOIN LATERAL (
        SELECT status, end_date FROM bus_subscriptions
        WHERE bus_id = b.id
        ORDER BY created_at DESC
        LIMIT 1
      ) bus_sub ON true
      WHERE b.operator_id = $1
      ORDER BY b.created_at DESC`,
      [req.params.id]
    );
    res.json({ buses: result.rows });
  } catch (error) {
    console.error('[Admin] Operator buses error:', error.message);
    res.status(500).json({ error: 'Failed to fetch operator buses' });
  }
});

/**
 * DELETE /api/admin/buses/:id
 * Admin can delete any bus.
 * Cancels all bookings on its routes first to avoid FK violation.
 */
router.delete('/buses/:id', async (req, res) => {
  try {
    const busId = req.params.id;

    // Verify bus exists
    const busCheck = await pool.query(
      'SELECT id, name FROM buses WHERE id = $1',
      [busId]
    );

    if (busCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    const busName = busCheck.rows[0].name;

    // Use a transaction to cancel bookings first, then delete bus
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Cancel all pending/confirmed bookings for routes of this bus
      await client.query(
        `UPDATE bookings SET status = 'cancelled'
         WHERE route_id IN (SELECT id FROM routes WHERE bus_id = $1)
         AND status IN ('pending', 'confirmed')`,
        [busId]
      );

      // 2. Release any held seats for routes of this bus
      await client.query(
        `UPDATE seats SET status = 'available', held_by = NULL, held_until = NULL
         WHERE route_id IN (SELECT id FROM routes WHERE bus_id = $1)
         AND status = 'held'`,
        [busId]
      );

      // 3. Delete the bus (routes/seats/subscriptions cascade)
      await client.query('DELETE FROM buses WHERE id = $1', [busId]);

      await client.query('COMMIT');

      console.log(`[Admin] Bus deleted: ${busName} (${busId}) by admin ${req.user.id}`);
      res.json({ message: 'Bus deleted successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Admin] Bus delete error:', error.message);
    res.status(500).json({ error: 'Failed to delete bus' });
  }
});

/**
 * GET /api/admin/subscribers
 * List all bus subscriptions with details.
 */
router.get('/subscribers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        bs.id, bs.bus_id, bs.operator_id, bs.start_date, bs.end_date,
        bs.amount_paid, bs.status, bs.created_at,
        b.name AS bus_name, b.bus_number,
        u.name AS operator_name, u.email AS operator_email
      FROM bus_subscriptions bs
      JOIN buses b ON bs.bus_id = b.id
      JOIN users u ON bs.operator_id = u.id
      ORDER BY bs.created_at DESC
      LIMIT 100
    `);
    res.json({ subscriptions: result.rows });
  } catch (error) {
    console.error('[Admin] Subscribers error:', error.message);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// ============================================================
// SETTINGS
// ============================================================

/**
 * GET /api/admin/settings
 * Get admin settings (subscription price, duration, etc).
 */
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM admin_settings');
    const settings = {};
    result.rows.forEach((row) => {
      settings[row.key] = row.value;
    });
    res.json({ settings });
  } catch (error) {
    console.error('[Admin] Settings error:', error.message);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * PUT /api/admin/settings/:key
 * Update an admin setting.
 */
router.put('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!value) {
      return res.status(400).json({ error: 'Value is required' });
    }

    await pool.query(
      `INSERT INTO admin_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, String(value)]
    );

    console.log(`[Admin] Setting ${key} updated to ${value} by admin ${req.user.id}`);
    res.json({ message: 'Setting updated', key, value });
  } catch (error) {
    console.error('[Admin] Settings update error:', error.message);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// ============================================================
// ADMIN REVENUE (Subscription-based)
// ============================================================

/**
 * GET /api/admin/revenue
 * Get admin revenue stats from bus subscriptions.
 */
router.get('/revenue', async (req, res) => {
  try {
    const [totalRevenue, monthlyRevenue, activeSubscriptions, recentPayments] =
      await Promise.all([
        pool.query(
          "SELECT COALESCE(SUM(amount_paid), 0)::float AS total FROM bus_subscriptions WHERE status = 'active' OR status = 'expired'"
        ),
        pool.query(`
          SELECT
            DATE_TRUNC('month', created_at) AS month,
            COALESCE(SUM(amount_paid), 0)::float AS total,
            COUNT(*) AS count
          FROM bus_subscriptions
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month DESC
          LIMIT 12
        `),
        pool.query(
          "SELECT COUNT(*)::int AS count FROM bus_subscriptions WHERE status = 'active'"
        ),
        pool.query(`
          SELECT bs.id, bs.amount_paid, bs.created_at, bs.status,
                 b.name AS bus_name, u.name AS operator_name
          FROM bus_subscriptions bs
          JOIN buses b ON bs.bus_id = b.id
          JOIN users u ON bs.operator_id = u.id
          ORDER BY bs.created_at DESC
          LIMIT 20
        `),
      ]);

    res.json({
      totalRevenue: totalRevenue.rows[0].total,
      activeSubscriptions: activeSubscriptions.rows[0].count,
      monthlyRevenue: monthlyRevenue.rows,
      recentPayments: recentPayments.rows,
    });
  } catch (error) {
    console.error('[Admin] Revenue error:', error.message);
    res.status(500).json({ error: 'Failed to fetch revenue stats' });
  }
});

// ============================================================
// HOLDS
// ============================================================

/**
 * GET /api/admin/holds
 * List all active seat holds.
 */
router.get('/holds', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id AS seat_id,
        s.seat_number,
        s.deck,
        s.type AS seat_type,
        s.held_until,
        u.id AS held_by_user_id,
        u.name AS held_by_name,
        u.email AS held_by_email,
        r.departure_time,
        r.travel_date,
        oc.name AS origin_city,
        dc.name AS destination_city,
        EXTRACT(EPOCH FROM (s.held_until - NOW())) / 60 AS minutes_remaining
      FROM seats s
      JOIN users u ON s.held_by = u.id
      JOIN routes r ON s.route_id = r.id
      JOIN cities oc ON r.origin_city_id = oc.id
      JOIN cities dc ON r.destination_city_id = dc.id
      WHERE s.status = 'held'
        AND s.held_until > NOW()
      ORDER BY s.held_until ASC
    `);

    res.json({ holds: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('[Admin] Holds error:', error.message);
    res.status(500).json({ error: 'Failed to fetch holds' });
  }
});

// ============================================================
// STATS
// ============================================================

/**
 * GET /api/admin/stats
 * Dashboard statistics.
 */
router.get('/stats', async (req, res) => {
  try {
    const [bookingsToday, revenueToday, activeHolds, availableSeats, totalOperators, adminSubscriptionRevenue] =
      await Promise.all([
        pool.query(
          "SELECT COUNT(*)::int AS count FROM bookings WHERE created_at::date = CURRENT_DATE"
        ),
        pool.query(
          "SELECT COALESCE(SUM(total_fare), 0)::float AS total FROM bookings WHERE created_at::date = CURRENT_DATE AND status = 'confirmed'"
        ),
        pool.query(
          "SELECT COUNT(*)::int AS count FROM seats WHERE status = 'held' AND held_until > NOW()"
        ),
        pool.query(
          "SELECT COUNT(*)::int AS count FROM seats WHERE status = 'available'"
        ),
        pool.query(
          "SELECT COUNT(*)::int AS count FROM users WHERE role = 'operator'"
        ),
        pool.query(
          "SELECT COALESCE(SUM(amount_paid), 0)::float AS total FROM bus_subscriptions WHERE status = 'active'"
        ),
      ]);

    res.json({
      bookingsToday: bookingsToday.rows[0].count,
      revenueToday: revenueToday.rows[0].total,
      adminRevenue: adminSubscriptionRevenue.rows[0].total,
      activeHolds: activeHolds.rows[0].count,
      availableSeats: availableSeats.rows[0].count,
      totalOperators: totalOperators.rows[0].count,
    });
  } catch (error) {
    console.error('[Admin] Stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================================
// REFUNDS
// ============================================================

/**
 * GET /api/admin/refunds
 * Refund statistics for admin dashboard.
 */
router.get('/refunds', async (req, res) => {
  try {
    const stats = await RefundService.getAdminRefundStats();
    res.json(stats);
  } catch (error) {
    console.error('[Admin] Refund stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch refund stats' });
  }
});

/**
 * POST /api/admin/refunds/:id/reprocess
 * Reprocess a failed refund.
 */
router.post('/refunds/:id/reprocess', async (req, res) => {
  try {
    const result = await RefundService.reprocessRefund(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('[Admin] Refund reprocess error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to reprocess refund' });
  }
});

module.exports = router;
