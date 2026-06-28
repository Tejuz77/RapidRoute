/**
 * RefundService — Tiered refund policy based on cancellation timing.
 *
 * Tiered refund policy — calculates refund based on time remaining before departure.
 * Optimistic refund processing — refund row inserted as pending before simulation
 * to ensure auditability.
 *
 * Refund Tiers:
 *   Full Refund (100%):    >48 hours before departure
 *   Partial Refund 75%:    24-48 hours before departure
 *   Partial Refund 50%:    12-24 hours before departure
 *   Partial Refund 25%:    4-12 hours before departure
 *   No Refund (0%):        <4 hours before departure
 */

const pool = require('../db/pool');
const SeatService = require('./SeatService');

class RefundService {
  /**
   * Calculate refund amount for a booking based on current time vs departure.
   *
   * @param {string} bookingId - UUID of the booking
   * @returns {Promise<Object>} { refundPercentage, refundAmount, tierName, description, hoursUntilDeparture }
   */
  async calculateRefund(bookingId) {
    const result = await pool.query(
      `SELECT b.total_fare, r.departure_time, r.travel_date, r.booking_cutoff_minutes
       FROM bookings b
       JOIN routes r ON b.route_id = r.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const { total_fare, departure_time, travel_date } = result.rows[0];
    const [hours, minutes] = departure_time.split(':').map(Number);
    const departureDateTime = new Date(travel_date);
    departureDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const diffMs = departureDateTime.getTime() - now.getTime();
    const hoursUntilDeparture = Math.max(0, diffMs / (1000 * 60 * 60));
    // Floor to integer for SQL comparison against INTEGER columns
    const hoursInt = Math.floor(hoursUntilDeparture);

    // Query the matching refund tier
    const tierResult = await pool.query(
      `SELECT tier_name, refund_percentage, description
       FROM refund_policy
       WHERE hours_before_departure_min <= $1
         AND (hours_before_departure_max IS NULL OR hours_before_departure_max > $1)
       ORDER BY hours_before_departure_min DESC
       LIMIT 1`,
      [hoursInt]
    );

    const tier = tierResult.rows[0] || {
      tier_name: 'No Refund',
      refund_percentage: 0,
      description: 'Cancelled less than 4 hours before departure — no refund',
    };

    const refundAmount = parseFloat(((total_fare * tier.refund_percentage) / 100).toFixed(2));

    return {
      refundPercentage: tier.refund_percentage,
      refundAmount,
      tierName: tier.tier_name,
      description: tier.description,
      hoursUntilDeparture: Math.round(hoursUntilDeparture * 10) / 10,
    };
  }

  /**
   * Process a cancellation with refund.
   * Inserts a pending refund row, simulates processing (90% success, 1-3s delay),
   * then updates status and releases seats.
   *
   * @param {string} bookingId - UUID of the booking
   * @returns {Promise<Object>} { bookingId, status, refund }
   */
  async processRefund(bookingId) {
    const booking = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (booking.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const bookingData = booking.rows[0];

    // Calculate refund
    const refundInfo = await this.calculateRefund(bookingId);

    // Update booking status to cancelled
    await pool.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = $1",
      [bookingId]
    );

    // Release seats back to available (seats are 'booked' status, not 'held')
    // Using releaseBookedSeats which bypasses the held_by/status checks
    await SeatService.releaseBookedSeats(bookingData.seat_ids);

    // Clear gender restrictions on released seats
    await this._clearGenderRestrictions(bookingData.seat_ids);

    // Insert refund record as pending (optimistic — for audit trail)
    const refundResult = await pool.query(
      `INSERT INTO refunds (booking_id, original_fare, refund_percentage, refund_amount, tier_name, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [bookingData.id, bookingData.total_fare, refundInfo.refundPercentage, refundInfo.refundAmount, refundInfo.tierName]
    );

    const refund = refundResult.rows[0];

    // Simulate refund processing (90% success rate, 1-3 second random delay)
    const isSuccess = Math.random() < 0.9;
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    if (isSuccess) {
      await pool.query(
        "UPDATE refunds SET status = 'processed', processed_at = NOW() WHERE id = $1",
        [refund.id]
      );
      refund.status = 'processed';
      refund.processed_at = new Date().toISOString();
      console.log(`[RefundService] Refund processed: ${refundInfo.refundAmount} for booking ${bookingId}`);
    } else {
      await pool.query(
        "UPDATE refunds SET status = 'failed', failure_reason = 'Payment gateway timeout' WHERE id = $1",
        [refund.id]
      );
      refund.status = 'failed';
      refund.failure_reason = 'Payment gateway timeout';
      console.log(`[RefundService] Refund failed for booking ${bookingId}`);
    }

    return {
      bookingId,
      status: 'cancelled',
      refund: {
        amount: refundInfo.refundAmount,
        percentage: refundInfo.refundPercentage,
        tierName: refundInfo.tierName,
        description: refundInfo.description,
        estimatedProcessingDays: isSuccess ? 3 : null,
        refundStatus: refund.status,
      },
    };
  }

  /**
   * Clear gender restrictions on released seats and their adjacent seats.
   * On cancellation — release gender restriction on adjacent seat if no longer needed.
   */
  async _clearGenderRestrictions(seatIds) {
    const seats = await pool.query(
      'SELECT id, seat_number, route_id FROM seats WHERE id = ANY($1)',
      [seatIds]
    );

    for (const seat of seats.rows) {
      // Find adjacent seat (same row, A↔B or C↔D)
      const match = seat.seat_number.match(/^(\d+)([A-D])$/);
      if (!match) continue;

      const rowNum = match[1];
      const colLetter = match[2];
      let adjacentCol;

      if (colLetter === 'A') adjacentCol = 'B';
      else if (colLetter === 'B') adjacentCol = 'A';
      else if (colLetter === 'C') adjacentCol = 'D';
      else if (colLetter === 'D') adjacentCol = 'C';

      if (!adjacentCol) continue;

      const adjacentSeatNumber = `${rowNum}${adjacentCol}`;

      // Check if adjacent seat is still booked (by another passenger)
      const adjacentResult = await pool.query(
        `SELECT s.* FROM seats s
         WHERE s.route_id = $1 AND s.seat_number = $2`,
        [seat.route_id, adjacentSeatNumber]
      );

      if (adjacentResult.rows.length > 0) {
        const adjacentSeat = adjacentResult.rows[0];
        // Only clear restriction if adjacent seat is available (not booked)
        if (adjacentSeat.status === 'available') {
          await pool.query(
            'UPDATE seats SET restricted_to_gender = NULL WHERE id = $1',
            [adjacentSeat.id]
          );
          console.log(`[RefundService] Cleared gender restriction on seat ${adjacentSeatNumber}`);
        }
      }
    }
  }

  /**
   * Get all refunds for a user.
   */
  async getUserRefunds(userId) {
    const result = await pool.query(
      `SELECT rf.*, b.route_id, r.departure_time, r.travel_date,
              oc.name AS origin_city, dc.name AS destination_city,
              b.seat_ids, b.passenger_names
       FROM refunds rf
       JOIN bookings b ON rf.booking_id = b.id
       JOIN routes r ON b.route_id = r.id
       JOIN cities oc ON r.origin_city_id = oc.id
       JOIN cities dc ON r.destination_city_id = dc.id
       WHERE b.user_id = $1
       ORDER BY rf.initiated_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get refund statistics for admin.
   */
  async getAdminRefundStats() {
    const today = await pool.query(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(refund_amount), 0)::float AS total_amount
       FROM refunds
       WHERE initiated_at::date = CURRENT_DATE`
    );

    const byTier = await pool.query(
      `SELECT tier_name, COUNT(*)::int AS count, COALESCE(SUM(refund_amount), 0)::float AS total_amount
       FROM refunds
       GROUP BY tier_name
       ORDER BY COUNT(*) DESC`
    );

    const failed = await pool.query(
      `SELECT rf.*, b.user_id, b.passenger_names
       FROM refunds rf
       JOIN bookings b ON rf.booking_id = b.id
       WHERE rf.status = 'failed'
       ORDER BY rf.initiated_at DESC
       LIMIT 20`
    );

    return {
      todayRefunds: today.rows[0],
      byTier: byTier.rows,
      failedRefunds: failed.rows,
    };
  }

  /**
   * Reprocess a failed refund.
   */
  async reprocessRefund(refundId) {
    const refund = await pool.query(
      'SELECT * FROM refunds WHERE id = $1 AND status = $2',
      [refundId, 'failed']
    );

    if (refund.rows.length === 0) {
      throw new Error('Failed refund not found');
    }

    // Simulate reprocessing
    const isSuccess = Math.random() < 0.9;
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (isSuccess) {
      await pool.query(
        "UPDATE refunds SET status = 'processed', processed_at = NOW(), failure_reason = NULL WHERE id = $1",
        [refundId]
      );
      return { success: true, message: 'Refund reprocessed successfully' };
    } else {
      await pool.query(
        "UPDATE refunds SET failure_reason = 'Reprocessing failed: payment gateway unavailable' WHERE id = $1",
        [refundId]
      );
      return { success: false, message: 'Reprocessing failed. Please try again.' };
    }
  }
}

module.exports = new RefundService();
