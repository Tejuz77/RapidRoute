/**
 * Payment routes — process payments with idempotency protection.
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const idempotencyMiddleware = require('../middleware/idempotency');
const PaymentService = require('../services/PaymentService');

const router = express.Router();

/**
 * POST /api/payments/process
 * Process payment for a booking.
 * Protected by idempotency middleware to prevent double charges.
 */
router.post('/process', authMiddleware, idempotencyMiddleware, async (req, res) => {
  try {
    const { bookingId, idempotencyKey } = req.body;

    if (!bookingId || !idempotencyKey) {
      return res.status(400).json({
        error: 'bookingId and idempotencyKey are required',
      });
    }

    const result = await PaymentService.processPayment(bookingId, idempotencyKey);

    console.log(
      `[Payments] Payment processed for booking ${bookingId}: ${result.status}`
    );

    res.json(result);
  } catch (error) {
    console.error('[Payments] Process error:', error.message);
    res.status(500).json({ error: error.message || 'Payment processing failed' });
  }
});

module.exports = router;
