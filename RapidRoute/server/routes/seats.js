/**
 * Seat routes — view, hold, and release seats with concurrency controls.
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const SeatService = require('../services/SeatService');
const pool = require('../db/pool');

const router = express.Router();

/**
 * GET /api/seats/:routeId
 * Returns all seats for a route with current status.
 * Used by the frontend polling mechanism for real-time updates.
 */
router.get('/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;

    const result = await pool.query(
      `SELECT s.*, 
              u.name AS held_by_name,
              booked.passenger_names AS booked_passenger_names,
              booked.passenger_gender,
              booked.user_name AS booked_by_user
       FROM seats s
       LEFT JOIN users u ON s.held_by = u.id
       LEFT JOIN LATERAL (
         SELECT b.passenger_names, 
                b.passenger_genders[array_position(b.seat_ids, s.id)] AS passenger_gender,
                u2.name AS user_name
         FROM bookings b
         JOIN users u2 ON b.user_id = u2.id
         WHERE b.status = 'confirmed'
           AND s.id = ANY(b.seat_ids)
         LIMIT 1
       ) booked ON true
       WHERE s.route_id = $1
       ORDER BY s.seat_number`,
      [routeId]
    );

    // Also return route info with booking_cutoff_minutes
    const routeResult = await pool.query(
      `SELECT r.*, b.type as bus_type, b.name as bus_name,
              oc.name as origin_city, dc.name as destination_city
       FROM routes r
       JOIN buses b ON r.bus_id = b.id
       JOIN cities oc ON r.origin_city_id = oc.id
       JOIN cities dc ON r.destination_city_id = dc.id
       WHERE r.id = $1`,
      [routeId]
    );

    res.json({
      seats: result.rows,
      count: result.rows.length,
      route: routeResult.rows[0] || null,
    });
  } catch (error) {
    console.error('[Seats] GET error:', error.message);
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

/**
 * POST /api/seats/hold
 * Hold selected seats for booking.
 * Protected by rate limiter and authentication.
 */
const bookingWindow = require('../utils/bookingWindow');

/**
 * POST /api/seats/hold
 * Hold selected seats for booking.
 * Protected by rate limiter and authentication.
 */
router.post('/hold', authMiddleware, rateLimiter, async (req, res) => {
  try {
    const { seatIds, routeId, passengerDetails } = req.body;
    const userId = req.user.id;

    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'seatIds array is required' });
    }

    if (!routeId) {
      return res.status(400).json({ error: 'routeId is required' });
    }

    // Concurrency-safe booking window check — validated server-side to prevent
    // race condition where frontend shows open but backend is already past cutoff.
    const routeInfo = await pool.query(
      'SELECT r.departure_time, r.travel_date, r.booking_cutoff_minutes FROM routes r WHERE r.id = $1',
      [routeId]
    );

    if (routeInfo.rows.length > 0) {
      const { departure_time, travel_date, booking_cutoff_minutes } = routeInfo.rows[0];
      if (!bookingWindow.isBookingOpen(departure_time, travel_date, booking_cutoff_minutes)) {
        const closesAt = bookingWindow.getBookingClosesAt(departure_time, travel_date, booking_cutoff_minutes);
        const minutesAgo = Math.floor((Date.now() - closesAt) / 60000);
        return res.status(400).json({
          code: 'BOOKING_CLOSED',
          message: `Booking for this route has closed. The booking window closed ${minutesAgo} minutes ago.`,
        });
      }
    }

    const result = await SeatService.holdSeats(userId, seatIds, routeId, { passengerDetails });

    console.log(`[Seats] User ${userId} held ${seatIds.length} seats on route ${routeId}`);

    res.json(result);
  } catch (error) {
    if (error.name === 'ConflictError') {
      return res.status(error.statusCode).json({
        error: error.message,
        type: 'ConflictError',
        message: error.message,
      });
    }
    console.error('[Seats] Hold error:', error.message);
    res.status(500).json({ error: 'Failed to hold seats' });
  }
});

/**
 * POST /api/seats/release
 * Release held seats.
 */
router.post('/release', authMiddleware, async (req, res) => {
  try {
    const { seatIds } = req.body;
    const userId = req.user.id;

    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'seatIds array is required' });
    }

    const releasedSeats = await SeatService.releaseSeats(seatIds, userId);

    console.log(`[Seats] User ${userId} released ${releasedSeats.length} seats`);

    res.json({ releasedSeats, count: releasedSeats.length });
  } catch (error) {
    console.error('[Seats] Release error:', error.message);
    res.status(500).json({ error: 'Failed to release seats' });
  }
});

module.exports = router;
