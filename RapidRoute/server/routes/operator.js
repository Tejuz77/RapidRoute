/**
 * Operator routes — Bus and route management for bus operators.
 *
 * Allows operator users to:
 * - Register new buses
 * - View their buses
 * - Create routes for their buses
 * - View bookings on their routes
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const pool = require('../db/pool');

const router = express.Router();

/**
 * Middleware to verify operator role.
 */
function requireOperator(req, res, next) {
  if (!req.user || (req.user.role !== 'operator' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Operator access required' });
  }
  next();
}

// All operator routes require auth + operator role
router.use(authMiddleware);
router.use(requireOperator);

/**
 * POST /api/operator/buses
 * Register a new bus.
 */
router.post('/buses', async (req, res) => {
  try {
    const { name, bus_number, type, total_seats, amenities } = req.body;

    if (!name || !bus_number || !type || !total_seats) {
      return res.status(400).json({ error: 'Name, bus number, type, and total seats are required' });
    }

    if (!['Sleeper', 'Semi-Sleeper', 'Seater'].includes(type)) {
      return res.status(400).json({ error: 'Type must be Sleeper, Semi-Sleeper, or Seater' });
    }

    const result = await pool.query(
      `INSERT INTO buses (name, bus_number, type, total_seats, amenities, operator_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, bus_number, type, total_seats, amenities || [], req.user.id]
    );

    const bus = result.rows[0];

    // Create bus subscription (charge operator for listing)
    const settingsResult = await pool.query(
      "SELECT value FROM admin_settings WHERE key = 'subscription_price'"
    );
    const priceResult = await pool.query(
      "SELECT value FROM admin_settings WHERE key = 'subscription_duration_days'"
    );
    const subscriptionPrice = parseFloat(settingsResult.rows[0]?.value || '4000');
    const subscriptionDays = parseInt(priceResult.rows[0]?.value || '180');

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + subscriptionDays);

    await pool.query(
      `INSERT INTO bus_subscriptions (bus_id, operator_id, start_date, end_date, amount_paid, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [bus.id, req.user.id, startDate, endDate, subscriptionPrice]
    );

    console.log(
      `[Operator] Bus registered: ${bus.name} (${bus.id}) with subscription ₹${subscriptionPrice} for ${subscriptionDays} days by operator ${req.user.id}`
    );

    res.status(201).json({
      bus,
      subscription: {
        amount: subscriptionPrice,
        durationDays: subscriptionDays,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    console.error('[Operator] Bus registration error:', error.message);
    res.status(500).json({ error: 'Failed to register bus' });
  }
});

/**
 * GET /api/operator/buses
 * List operator's buses.
 */
router.get('/buses', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        b.*,
        COUNT(DISTINCT r.id) AS total_routes,
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
      WHERE b.operator_id = $1
      GROUP BY b.id
      ORDER BY b.created_at DESC NULLS LAST, b.name`,
      [req.user.id]
    );

    // Calculate occupancy for each bus
    const buses = result.rows.map((bus) => ({
      ...bus,
      occupancy_percentage:
        bus.total_seats > 0
          ? Math.round(
              ((bus.booked_seats + bus.held_seats) /
                ((bus.total_routes || 1) * bus.total_seats || 1)) *
                100
            )
          : 0,
    }));

    res.json({ buses });
  } catch (error) {
    console.error('[Operator] Buses error:', error.message);
    res.status(500).json({ error: 'Failed to fetch buses' });
  }
});

/**
 * GET /api/operator/buses/:id
 * Get bus details with routes.
 */
router.get('/buses/:id', async (req, res) => {
  try {
    const busResult = await pool.query(
      'SELECT * FROM buses WHERE id = $1 AND operator_id = $2',
      [req.params.id, req.user.id]
    );

    if (busResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    const routesResult = await pool.query(
      `SELECT r.*, oc.name AS origin_city, dc.name AS destination_city,
              (SELECT COUNT(*) FROM seats s WHERE s.route_id = r.id AND s.status = 'booked') AS booked_seats,
              (SELECT COUNT(*) FROM seats s WHERE s.route_id = r.id AND s.status = 'held') AS held_seats
       FROM routes r
       JOIN cities oc ON r.origin_city_id = oc.id
       JOIN cities dc ON r.destination_city_id = dc.id
       WHERE r.bus_id = $1
       ORDER BY r.travel_date DESC, r.departure_time`,
      [req.params.id]
    );

    res.json({ bus: busResult.rows[0], routes: routesResult.rows });
  } catch (error) {
    console.error('[Operator] Bus detail error:', error.message);
    res.status(500).json({ error: 'Failed to fetch bus details' });
  }
});

/**
 * DELETE /api/operator/buses/:id
 * Delete a bus (and its routes/seats via CASCADE).
 * Cancels all bookings on its routes first to avoid FK violation.
 */
router.delete('/buses/:id', async (req, res) => {
  try {
    const busId = req.params.id;

    // Verify bus ownership first
    const busCheck = await pool.query(
      'SELECT id, name FROM buses WHERE id = $1 AND operator_id = $2',
      [busId, req.user.id]
    );

    if (busCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bus not found or not owned by you' });
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
      await client.query(
        'DELETE FROM buses WHERE id = $1 AND operator_id = $2',
        [busId, req.user.id]
      );

      await client.query('COMMIT');

      console.log(`[Operator] Bus deleted: ${busName} (${busId}) by operator ${req.user.id}`);
      res.json({ message: 'Bus deleted successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Operator] Bus delete error:', error.message);
    res.status(500).json({ error: 'Failed to delete bus' });
  }
});

/**
 * PATCH /api/operator/buses/:id/cancel-temp
 * Temporarily cancel a bus for a specific date range.
 */
router.patch('/buses/:id/cancel-temp', async (req, res) => {
  try {
    const { from_date, until_date } = req.body;
    const busId = req.params.id;

    // Verify bus ownership
    const busCheck = await pool.query(
      'SELECT * FROM buses WHERE id = $1 AND operator_id = $2',
      [busId, req.user.id]
    );

    if (busCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bus not found or not owned by you' });
    }

    if (from_date && until_date) {
      // Cancel for a specific date range
      await pool.query(
        `UPDATE buses
         SET status = 'temporarily_cancelled', cancelled_from = $1, cancelled_until = $2
         WHERE id = $3 AND operator_id = $4`,
        [from_date, until_date, busId, req.user.id]
      );
      console.log(`[Operator] Bus ${busId} temporarily cancelled from ${from_date} to ${until_date} by operator ${req.user.id}`);
    } else if (from_date && !until_date) {
      // Cancel for a single day
      await pool.query(
        `UPDATE buses
         SET status = 'temporarily_cancelled', cancelled_from = $1, cancelled_until = $1
         WHERE id = $2 AND operator_id = $3`,
        [from_date, busId, req.user.id]
      );
      console.log(`[Operator] Bus ${busId} temporarily cancelled on ${from_date} by operator ${req.user.id}`);
    } else {
      // Cancel all upcoming (from today, no end date)
      const today = new Date().toISOString().split('T')[0];
      await pool.query(
        `UPDATE buses
         SET status = 'temporarily_cancelled', cancelled_from = $1, cancelled_until = NULL
         WHERE id = $2 AND operator_id = $3`,
        [today, busId, req.user.id]
      );
      console.log(`[Operator] Bus ${busId} cancelled all upcoming by operator ${req.user.id}`);
    }

    res.json({ message: 'Bus temporarily cancelled', busId });
  } catch (error) {
    console.error('[Operator] Temp cancel error:', error.message);
    res.status(500).json({ error: 'Failed to cancel bus temporarily' });
  }
});

/**
 * PATCH /api/operator/buses/:id/reactivate
 * Reactivate a temporarily cancelled bus.
 */
router.patch('/buses/:id/reactivate', async (req, res) => {
  try {
    const busId = req.params.id;

    const result = await pool.query(
      `UPDATE buses
       SET status = 'active', cancelled_from = NULL, cancelled_until = NULL
       WHERE id = $1 AND operator_id = $2
       RETURNING id, name, status`,
      [busId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bus not found or not owned by you' });
    }

    console.log(`[Operator] Bus ${busId} reactivated by operator ${req.user.id}`);
    res.json({ message: 'Bus reactivated', bus: result.rows[0] });
  } catch (error) {
    console.error('[Operator] Reactivate error:', error.message);
    res.status(500).json({ error: 'Failed to reactivate bus' });
  }
});

/**
 * GET /api/operator/buses/:id/subscription
 * Check bus subscription status.
 */
router.get('/buses/:id/subscription', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM bus_subscriptions
       WHERE bus_id = $1 AND operator_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ subscription: null });
    }

    const sub = result.rows[0];
    const now = new Date();
    const isExpired = new Date(sub.end_date) < now;

    // Auto-update status if expired
    if (isExpired && sub.status === 'active') {
      await pool.query(
        "UPDATE bus_subscriptions SET status = 'expired' WHERE id = $1",
        [sub.id]
      );
      sub.status = 'expired';
    }

    res.json({ subscription: { ...sub, isExpired } });
  } catch (error) {
    console.error('[Operator] Subscription check error:', error.message);
    res.status(500).json({ error: 'Failed to check subscription' });
  }
});

/**
 * POST /api/operator/buses/:id/cancel-subscription
 * Cancel the active subscription for this bus (operator chooses not to continue).
 */
router.post('/buses/:id/cancel-subscription', async (req, res) => {
  try {
    const busId = req.params.id;

    // Verify bus ownership
    const busCheck = await pool.query(
      'SELECT * FROM buses WHERE id = $1 AND operator_id = $2',
      [busId, req.user.id]
    );

    if (busCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bus not found or not owned by you' });
    }

    // Update the most recent active/expired subscription to 'cancelled'
    const result = await pool.query(
      `UPDATE bus_subscriptions
       SET status = 'cancelled'
       WHERE bus_id = $1 AND operator_id = $2 AND status IN ('active', 'expired')
       RETURNING id`,
      [busId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active or expired subscription found to cancel' });
    }

    console.log(`[Operator] Bus ${busId} subscription cancelled by operator ${req.user.id}`);
    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('[Operator] Cancel subscription error:', error.message);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * POST /api/operator/buses/:id/renew-subscription
 * Renew or re-subscribe a bus.
 */
router.post('/buses/:id/renew-subscription', async (req, res) => {
  try {
    const busId = req.params.id;

    // Verify bus ownership
    const busCheck = await pool.query(
      'SELECT * FROM buses WHERE id = $1 AND operator_id = $2',
      [busId, req.user.id]
    );

    if (busCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bus not found or not owned by you' });
    }

    const settingsResult = await pool.query(
      "SELECT value FROM admin_settings WHERE key = 'subscription_price'"
    );
    const durationResult = await pool.query(
      "SELECT value FROM admin_settings WHERE key = 'subscription_duration_days'"
    );
    const subscriptionPrice = parseFloat(settingsResult.rows[0]?.value || '4000');
    const subscriptionDays = parseInt(durationResult.rows[0]?.value || '180');

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + subscriptionDays);

    await pool.query(
      `INSERT INTO bus_subscriptions (bus_id, operator_id, start_date, end_date, amount_paid, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [busId, req.user.id, startDate, endDate, subscriptionPrice]
    );

    console.log(`[Operator] Bus ${busId} subscription renewed by operator ${req.user.id}`);
    res.json({
      message: 'Subscription renewed',
      subscription: { amount: subscriptionPrice, durationDays: subscriptionDays, endDate },
    });
  } catch (error) {
    console.error('[Operator] Subscription renew error:', error.message);
    res.status(500).json({ error: 'Failed to renew subscription' });
  }
});

/**
 * POST /api/operator/routes
 * Create a new route for a bus.
 */
router.post('/routes', async (req, res) => {
  try {
    const {
      bus_id,
      origin_city_id,
      destination_city_id,
      departure_time,
      arrival_time,
      duration_minutes,
      fare,
      travel_date,
    } = req.body;

    if (!bus_id || !origin_city_id || !destination_city_id || !departure_time || !arrival_time || !fare || !travel_date) {
      return res.status(400).json({ error: 'All route fields are required' });
    }

    // Verify bus belongs to this operator
    const busCheck = await pool.query(
      'SELECT * FROM buses WHERE id = $1 AND operator_id = $2',
      [bus_id, req.user.id]
    );

    if (busCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bus not found or not owned by you' });
    }

    const bus = busCheck.rows[0];

    // Calculate duration if not provided
    let duration = duration_minutes;
    if (!duration) {
      const depParts = departure_time.split(':').map(Number);
      const arrParts = arrival_time.split(':').map(Number);
      let depMinutes = depParts[0] * 60 + depParts[1];
      let arrMinutes = arrParts[0] * 60 + arrParts[1];
      if (arrMinutes <= depMinutes) arrMinutes += 1440; // Next day
      duration = arrMinutes - depMinutes;
    }

    // Begin transaction to create route + seats
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create the route
      const routeResult = await client.query(
        `INSERT INTO routes (origin_city_id, destination_city_id, bus_id, departure_time, arrival_time, duration_minutes, fare, travel_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [origin_city_id, destination_city_id, bus_id, departure_time, arrival_time, duration, fare, travel_date]
      );

      const route = routeResult.rows[0];

      // Generate seats for this route
      const seatNumbers = [];
      const decks = [];
      const types = [];

      for (let row = 1; row <= bus.total_seats / 4; row++) {
        for (const col of ['A', 'B', 'C', 'D']) {
          const seatNum = `${row}${col}`;
          const deck =
            bus.type === 'Sleeper' && row <= bus.total_seats / 8
              ? 'lower'
              : bus.type === 'Sleeper'
              ? 'upper'
              : 'lower';
          const type = col === 'A' || col === 'D' ? 'window' : 'aisle';
          seatNumbers.push(seatNum);
          decks.push(deck);
          types.push(type);
        }
      }

      // Batch insert seats
      for (let i = 0; i < seatNumbers.length; i++) {
        await client.query(
          `INSERT INTO seats (route_id, seat_number, deck, type)
           VALUES ($1, $2, $3, $4)`,
          [route.id, seatNumbers[i], decks[i], types[i]]
        );
      }

      await client.query('COMMIT');

      console.log(
        `[Operator] Route created: ${route.id} with ${seatNumbers.length} seats by operator ${req.user.id}`
      );

      res.status(201).json({
        route,
        seats_created: seatNumbers.length,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Operator] Route creation error:', error.message);
    res.status(500).json({ error: 'Failed to create route' });
  }
});

/**
 * GET /api/operator/routes
 * List all routes for operator's buses, with optional filters.
 */
router.get('/routes', async (req, res) => {
  try {
    const { bus_id, date, status } = req.query;
    const conditions = ['b.operator_id = $1'];
    const params = [req.user.id];
    let paramIndex = 2;

    if (bus_id) {
      conditions.push(`r.bus_id = $${paramIndex++}`);
      params.push(bus_id);
    }
    if (date) {
      conditions.push(`r.travel_date = $${paramIndex++}`);
      params.push(date);
    }

    const result = await pool.query(
      `SELECT
        r.id, r.departure_time, r.arrival_time, r.duration_minutes, r.fare, r.travel_date,
        r.bus_id,
        b.name AS bus_name, b.bus_number, b.type AS bus_type,
        oc.name AS origin_city, dc.name AS destination_city,
        (SELECT COUNT(*) FROM seats s WHERE s.route_id = r.id) AS total_seats,
        (SELECT COUNT(*) FROM seats s WHERE s.route_id = r.id AND s.status = 'available') AS available_seats,
        (SELECT COUNT(*) FROM seats s WHERE s.route_id = r.id AND s.status = 'booked') AS booked_seats
      FROM routes r
      JOIN buses b ON r.bus_id = b.id
      JOIN cities oc ON r.origin_city_id = oc.id
      JOIN cities dc ON r.destination_city_id = dc.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.travel_date DESC, r.departure_time
      LIMIT 100`,
      params
    );

    res.json({ routes: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('[Operator] Routes error:', error.message);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

/**
 * DELETE /api/operator/routes/:id
 * Delete a route (cascades to seat deletions).
 * Cancels any bookings on this route first to avoid FK violation.
 */
router.delete('/routes/:id', async (req, res) => {
  try {
    const routeId = req.params.id;

    // Verify route ownership
    const routeCheck = await pool.query(
      `SELECT r.id FROM routes r
       JOIN buses b ON r.bus_id = b.id
       WHERE r.id = $1 AND b.operator_id = $2`,
      [routeId, req.user.id]
    );

    if (routeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Route not found or not owned by you' });
    }

    // Use a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Cancel all pending/confirmed bookings for this route
      await client.query(
        `UPDATE bookings SET status = 'cancelled'
         WHERE route_id = $1 AND status IN ('pending', 'confirmed')`,
        [routeId]
      );

      // 2. Release any held seats for this route
      await client.query(
        `UPDATE seats SET status = 'available', held_by = NULL, held_until = NULL
         WHERE route_id = $1 AND status = 'held'`,
        [routeId]
      );

      // 3. Delete the route (seats cascade)
      await client.query('DELETE FROM routes WHERE id = $1', [routeId]);

      await client.query('COMMIT');

      console.log(`[Operator] Route deleted: ${routeId} by operator ${req.user.id}`);
      res.json({ message: 'Route deleted successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Operator] Route delete error:', error.message);
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

/**
 * GET /api/operator/bookings
 * View bookings on operator's routes.
 */
router.get('/bookings', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        b.id, b.total_fare, b.status, b.created_at, b.seat_ids, b.passenger_names,
        u.name AS user_name, u.email AS user_email,
        r.departure_time, r.travel_date,
        bus.name AS bus_name, bus.bus_number,
        oc.name AS origin_city, dc.name AS destination_city
      FROM bookings b
      JOIN routes r ON b.route_id = r.id
      JOIN buses bus ON r.bus_id = bus.id
      JOIN users u ON b.user_id = u.id
      JOIN cities oc ON r.origin_city_id = oc.id
      JOIN cities dc ON r.destination_city_id = dc.id
      WHERE bus.operator_id = $1
      ORDER BY b.created_at DESC
      LIMIT 50`,
      [req.user.id]
    );

    res.json({ bookings: result.rows });
  } catch (error) {
    console.error('[Operator] Bookings error:', error.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/operator/cities
 * List all cities (for route creation dropdowns).
 */
router.get('/cities', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cities ORDER BY name');
    res.json({ cities: result.rows });
  } catch (error) {
    console.error('[Operator] Cities error:', error.message);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

/**
 * GET /api/operator/stats
 * Dashboard statistics for the operator — total revenue from ALL confirmed
 * bookings (not limited to 50), plus counts for buses, routes, and bookings.
 */
router.get('/stats', async (req, res) => {
  try {
    const [revenueResult, busCount, routeCount, bookingCount] =
      await Promise.all([
        pool.query(
          `SELECT COALESCE(SUM(b.total_fare), 0)::float AS total
           FROM bookings b
           JOIN routes r ON b.route_id = r.id
           JOIN buses bus ON r.bus_id = bus.id
           WHERE bus.operator_id = $1
             AND b.status = 'confirmed'`,
          [req.user.id]
        ),
        pool.query(
          'SELECT COUNT(*)::int AS count FROM buses WHERE operator_id = $1',
          [req.user.id]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM routes r
           JOIN buses bus ON r.bus_id = bus.id
           WHERE bus.operator_id = $1`,
          [req.user.id]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM bookings b
           JOIN routes r ON b.route_id = r.id
           JOIN buses bus ON r.bus_id = bus.id
           WHERE bus.operator_id = $1`,
          [req.user.id]
        ),
      ]);

    res.json({
      totalRevenue: revenueResult.rows[0].total,
      totalBuses: busCount.rows[0].count,
      totalRoutes: routeCount.rows[0].count,
      totalBookings: bookingCount.rows[0].count,
    });
  } catch (error) {
    console.error('[Operator] Stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
