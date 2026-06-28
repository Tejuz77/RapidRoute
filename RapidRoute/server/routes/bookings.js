/**
 * Booking routes — confirm, list, and cancel bookings with idempotency.
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const idempotencyMiddleware = require('../middleware/idempotency');
const BookingService = require('../services/BookingService');
const RefundService = require('../services/RefundService');

const router = express.Router();

/**
 * POST /api/bookings/confirm
 * Confirm a booking with idempotency protection.
 */
router.post('/confirm', authMiddleware, idempotencyMiddleware, async (req, res) => {
  try {
    const { routeId, seatIds, passengerNames, passengerGenders, idempotencyKey } = req.body;
    const userId = req.user.id;

    if (!routeId || !seatIds || !passengerNames || !idempotencyKey) {
      return res.status(400).json({
        error: 'routeId, seatIds, passengerNames, and idempotencyKey are required',
      });
    }

    if (seatIds.length !== passengerNames.length) {
      return res.status(400).json({
        error: 'seatIds and passengerNames must have the same length',
      });
    }

    const booking = await BookingService.confirmBooking(
      userId,
      routeId,
      seatIds,
      passengerNames,
      idempotencyKey,
      passengerGenders
    );

    console.log(`[Bookings] Booking confirmed: ${booking.id} for user ${userId}`);

    res.status(201).json({ booking });
  } catch (error) {
    if (error.name === 'ConflictError') {
      return res.status(error.statusCode).json({
        error: error.message,
        type: 'ConflictError',
        message: error.message,
      });
    }
    console.error('[Bookings] Confirm error:', error.message);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

/**
 * GET /api/bookings/my
 * Get current user's bookings.
 */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const bookings = await BookingService.getUserBookings(req.user.id);
    res.json({ bookings });
  } catch (error) {
    console.error('[Bookings] My bookings error:', error.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * PATCH /api/bookings/:id/cancel
 * Cancel a booking with refund processing.
 */
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const result = await RefundService.processRefund(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('[Bookings] Cancel error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to cancel booking' });
  }
});

/**
 * GET /api/bookings/refunds
 * Get refund history for current user.
 */
router.get('/refunds', authMiddleware, async (req, res) => {
  try {
    const refunds = await RefundService.getUserRefunds(req.user.id);
    res.json({ refunds });
  } catch (error) {
    console.error('[Bookings] Refunds error:', error.message);
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
});

module.exports = router;
