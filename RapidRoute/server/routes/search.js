/**
 * Search routes — find available buses for a given origin, destination, and date.
 */

const express = require('express');
const pool = require('../db/pool');
const { getBookingWindowStatus } = require('../utils/bookingWindow');

const router = express.Router();

/**
 * GET /api/search?from=&to=&date=
 * Returns routes with available seat count and booking window info.
 */
router.get('/', async (req, res) => {
  try {
    const { from, to, date } = req.query;

    if (!from || !to || !date) {
      return res.status(400).json({ error: 'from, to, and date parameters are required' });
    }

    const query = `
      SELECT
        r.id,
        r.departure_time,
        r.arrival_time,
        r.duration_minutes,
        r.fare,
        r.travel_date,
        r.booking_cutoff_minutes,
        oc.name AS origin_city,
        oc.state AS origin_state,
        dc.name AS destination_city,
        dc.state AS destination_state,
        b.id AS bus_id,
        b.name AS bus_name,
        b.bus_number,
        b.type AS bus_type,
        b.amenities,
        b.total_seats,
        b.status AS bus_status,
        b.cancelled_from,
        b.cancelled_until,
        (SELECT COUNT(*) FROM seats s WHERE s.route_id = r.id AND s.status = 'available') AS available_seats
      FROM routes r
      JOIN cities oc ON r.origin_city_id = oc.id
      JOIN cities dc ON r.destination_city_id = dc.id
      JOIN buses b ON r.bus_id = b.id
      WHERE oc.id = $1
        AND dc.id = $2
        AND r.travel_date = $3::date
      ORDER BY r.departure_time ASC
    `;

    const result = await pool.query(query, [from, to, date]);

    // Add booking window info to each route
    const routesWithWindow = result.rows.map((route) => ({
      ...route,
      ...getBookingWindowStatus(route.departure_time, route.travel_date, route.booking_cutoff_minutes || 60),
    }));

    console.log(`[Search] Found ${routesWithWindow.length} routes from city ${from} to ${to} on ${date}`);

    res.json({ routes: routesWithWindow, count: routesWithWindow.length });
  } catch (error) {
    console.error('[Search] Error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/cities
 * List all cities for dropdowns.
 */
router.get('/cities', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, state FROM cities ORDER BY name');
    res.json({ cities: result.rows });
  } catch (error) {
    console.error('[Cities] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

module.exports = router;
