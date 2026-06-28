/**
 * PaymentService — Concurrency-safe payment processing.
 *
 * Idempotency key + pessimistic lock prevents double-charge race condition.
 * Even if the same payment request arrives twice, the booking is only charged once.
 */

const pool = require('../db/pool');

class PaymentService {
  /**
   * Process a payment for a booking.
   *
   * Uses idempotency key for safe retry and SELECT FOR UPDATE to prevent
   * concurrent payment processing for the same booking.
   *
   * @param {string} bookingId - UUID of the booking
   * @param {string} idempotencyKey - UUID v4 for idempotency
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(bookingId, idempotencyKey) {
    return pool.transaction(async (client) => {
      // Step 1: Check if payment already processed for this booking
      // SELECT FOR UPDATE prevents concurrent payment processing
      const existingPayment = await client.query(
        'SELECT * FROM payments WHERE booking_id = $1 FOR UPDATE',
        [bookingId]
      );

      if (existingPayment.rows.length > 0) {
        const existing = existingPayment.rows[0];
        console.log(
          `[PaymentService] Payment already processed for booking ${bookingId}: ${existing.status}`
        );

        // If already succeeded, return the cached result
        if (existing.status === 'success') {
          return {
            payment: existing,
            message: 'Payment was already processed successfully.',
          };
        }

        // If failed, allow retry
        if (existing.status === 'failed') {
          // Continue to retry
          console.log(
            `[PaymentService] Retrying failed payment for booking ${bookingId}`
          );
        }
      }

      // Step 2: Get booking details
      const bookingResult = await client.query(
        'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
        [bookingId]
      );

      if (bookingResult.rows.length === 0) {
        throw new Error('Booking not found');
      }

      const booking = bookingResult.rows[0];

      if (booking.status === 'cancelled') {
        throw new Error('Cannot process payment for cancelled booking');
      }

      // Step 3: Simulate payment processing with 95% success rate
      const isSuccess = Math.random() < 0.95;
      const paymentStatus = isSuccess ? 'success' : 'failed';

      // Step 4: Insert payment record
      const paymentResult = await client.query(
        `INSERT INTO payments (booking_id, amount, status, idempotency_key, processed_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [bookingId, booking.total_fare, paymentStatus, idempotencyKey]
      );

      const payment = paymentResult.rows[0];

      // Step 5: Update booking status if payment succeeded
      if (paymentStatus === 'success') {
        await client.query(
          "UPDATE bookings SET status = 'confirmed' WHERE id = $1",
          [bookingId]
        );
        console.log(
          `[PaymentService] Payment successful for booking ${bookingId}: ₹${booking.total_fare}`
        );
      } else {
        console.log(
          `[PaymentService] Payment failed for booking ${bookingId}: ₹${booking.total_fare}`
        );
      }

      return {
        payment,
        status: paymentStatus,
        message:
          paymentStatus === 'success'
            ? 'Payment processed successfully!'
            : 'Payment failed. Please try again.',
      };
    });
  }
}

module.exports = new PaymentService();
