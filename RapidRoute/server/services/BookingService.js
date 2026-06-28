/**
 * BookingService — Concurrency-safe booking confirmation.
 *
 * Pessimistic lock prevents concurrent confirmation of the same booking.
 * Uses idempotency key to ensure safe retries without duplicate bookings.
 * After confirmation, publishes events to the message queue for async
 * processing (email, PDF, analytics) via the worker thread pool.
 */

const pool = require('../db/pool');
const messageQueue = require('../queue/MessageQueue');
const metricsCollector = require('../services/MetricsCollector');

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class BookingService {
  /**
   * Confirm a booking after seat hold.
   *
   * Uses pessimistic locking (SELECT FOR UPDATE on idempotency_key)
   * to prevent concurrent confirmation of the same booking.
   *
   * @param {string} userId - UUID of the user
   * @param {string} routeId - UUID of the route
   * @param {string[]} seatIds - Array of seat UUIDs
   * @param {string[]} passengerNames - Array of passenger names
   * @param {string} idempotencyKey - UUID v4 for idempotency
   * @param {string[]} [passengerGenders] - Array of passenger genders for gender adjacency
   * @returns {Promise<Object>} Created booking
   */
  async confirmBooking(userId, routeId, seatIds, passengerNames, idempotencyKey, passengerGenders) {
    return pool.transaction(async (client) => {
      // Step 1: Pessimistic lock on booking by idempotency key
      // This prevents two concurrent requests from creating duplicate bookings.
      const existingBooking = await client.query(
        'SELECT * FROM bookings WHERE idempotency_key = $1 FOR UPDATE',
        [idempotencyKey]
      );

      if (existingBooking.rows.length > 0) {
        console.log(
          `[BookingService] Duplicate booking detected (idempotency key: ${idempotencyKey})`
        );
        return existingBooking.rows[0];
      }

      // Step 2: Get route fare
      const routeResult = await client.query(
        'SELECT id, fare FROM routes WHERE id = $1',
        [routeId]
      );

      if (routeResult.rows.length === 0) {
        throw new Error('Route not found');
      }

      const totalFare = routeResult.rows[0].fare * seatIds.length;

      // Step 3: Verify all seats are still held by this user
      const seatsResult = await client.query(
        `SELECT * FROM seats
         WHERE id = ANY($1)
           AND held_by = $2
           AND status = 'held'
         FOR UPDATE`,
        [seatIds, userId]
      );

      if (seatsResult.rows.length !== seatIds.length) {
        throw new ConflictError(
          'Some seats are no longer held by you. Please reselect seats.'
        );
      }

      // Step 4: Create booking
      const bookingResult = await client.query(
        `INSERT INTO bookings (user_id, route_id, seat_ids, passenger_names, passenger_genders, total_fare, status, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7)
         RETURNING *`,
        [userId, routeId, seatIds, passengerNames, passengerGenders || null, totalFare, idempotencyKey]
      );

      const booking = bookingResult.rows[0];

      // Step 5: Update seats to booked status with optimistic locking
      const seatUpdate = await client.query(
        `UPDATE seats
         SET status = 'booked',
             version = version + 1
         WHERE id = ANY($1)
           AND held_by = $2
           AND status = 'held'
         RETURNING *`,
        [seatIds, userId]
      );

      if (seatUpdate.rowCount !== seatIds.length) {
        await client.query('ROLLBACK');
        throw new ConflictError('Failed to book some seats. Please try again.');
      }

      // Step 6: Apply gender adjacency restrictions based on confirmed passenger genders
      // Gender adjacency rule — protects passengers by restricting the seat beside
      // a booked seat to the same gender. This runs after booking confirmation
      // when passenger genders are available.
      if (passengerGenders && Array.isArray(passengerGenders) && passengerGenders.length > 0) {
        await this._applyGenderAdjacency(client, seatUpdate.rows, passengerGenders);
      }

      console.log(
        `[BookingService] Booking confirmed: ${booking.id} for user ${userId}`
      );

      // Publish to message queue for async processing (email, PDF, analytics)
      // The message queue handler dispatches worker pool tasks off the main thread.
      try {
        messageQueue.publish('booking.confirmed', {
          bookingId: booking.id,
          routeId,
          userId,
          seatIds,
          passengerNames,
          totalFare,
        });

        // Track metrics
        metricsCollector.recordConcurrencyEvent('booking.confirmed', {
          bookingId: booking.id,
          userId,
          seatCount: seatIds.length,
        });
      } catch (mqError) {
        // Non-blocking — don't fail the booking if async processing fails
        console.error('[BookingService] Failed to publish to message queue:', mqError.message);
      }

      return booking;
    });
  }

  /**
   * Apply gender-based adjacency restrictions to seats beside booked seats.
   * Group booking exception — gender adjacency restrictions are applied after
   * all seats in the same booking are assigned, so a mixed-gender group booking
   * adjacent seats always succeeds.
   */
  async _applyGenderAdjacency(client, bookedSeats, passengerGenders) {
    for (let i = 0; i < bookedSeats.length && i < passengerGenders.length; i++) {
      const seat = bookedSeats[i];
      const gender = passengerGenders[i];

      if (!gender || gender === 'other') continue;
      if (gender !== 'male' && gender !== 'female') continue;
      // Find adjacent seat in the same row (2-2 layout: A-B gap C-D)
      const adjacentSeatNumber = this._getAdjacentSeatNumber(seat.seat_number);
      if (!adjacentSeatNumber) continue;

      // Check if adjacent seat is also being booked in this same transaction
      const beingBookedInThisTx = bookedSeats.some(
        (s) => s.seat_number === adjacentSeatNumber
      );
      if (beingBookedInThisTx) continue;

      // Update the adjacent seat's gender restriction
      const adjResult = await client.query(
        `UPDATE seats
         SET restricted_to_gender = $1
         WHERE route_id = $2
           AND seat_number = $3
           AND (restricted_to_gender IS NULL OR restricted_to_gender = $1)
           AND status = 'available'
         RETURNING *`,
        [gender, seat.route_id, adjacentSeatNumber]
      );

      if (adjResult.rowCount > 0) {
        console.log(
          `[BookingService] Gender adjacency: seat ${adjacentSeatNumber} restricted to ${gender} (adjacent to booked seat ${seat.seat_number})`
        );
      }
    }
  }

  /**
   * Get the adjacent seat number based on 2-2 layout (A↔B, C↔D).
   */
  _getAdjacentSeatNumber(seatNumber) {
    const match = seatNumber.match(/^(\d+)([A-D])$/);
    if (!match) return null;
    const rowNum = match[1];
    const colLetter = match[2];
    const adjacency = { A: 'B', B: 'A', C: 'D', D: 'C' };
    const adjacentCol = adjacency[colLetter];
    if (!adjacentCol) return null;
    return `${rowNum}${adjacentCol}`;
  }

  /**
   * Get all bookings for a user.
   */
  async getUserBookings(userId) {
    const result = await pool.query(
      `SELECT b.*, r.departure_time, r.arrival_time, r.travel_date, r.fare,
              oc.name as origin_city, dc.name as destination_city,
              bus.name as bus_name, bus.bus_number,
              COALESCE(
                (SELECT array_agg(s.seat_number ORDER BY s.seat_number)
                 FROM seats s
                 WHERE s.id = ANY(b.seat_ids)),
                ARRAY[]::text[]
              ) AS seat_numbers
       FROM bookings b
       JOIN routes r ON b.route_id = r.id
       JOIN cities oc ON r.origin_city_id = oc.id
       JOIN cities dc ON r.destination_city_id = dc.id
       JOIN buses bus ON r.bus_id = bus.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Cancel a booking.
   * On cancellation — release gender restriction on adjacent seat if no longer needed.
   */
  async cancelBooking(bookingId, userId) {
    return pool.transaction(async (client) => {
      const bookingResult = await client.query(
        'SELECT * FROM bookings WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [bookingId, userId]
      );

      if (bookingResult.rows.length === 0) {
        throw new Error('Booking not found');
      }

      const booking = bookingResult.rows[0];

      if (booking.status === 'cancelled') {
        throw new Error('Booking is already cancelled');
      }

      // Update booking status
      await client.query(
        "UPDATE bookings SET status = 'cancelled' WHERE id = $1",
        [bookingId]
      );

      // Release seats back to available
      await client.query(
        `UPDATE seats
         SET status = 'available',
             held_by = NULL,
             held_until = NULL,
             restricted_to_gender = NULL,
             version = version + 1
         WHERE id = ANY($1)`,
        [booking.seat_ids]
      );

      // Clear gender restrictions on adjacent seats if no longer needed
      await this._clearAdjacentGenderRestrictions(booking.seat_ids);

      console.log(`[BookingService] Booking cancelled: ${bookingId}`);
      return { id: bookingId, status: 'cancelled' };
    });
  }

  /**
   * Clear gender restrictions on adjacent seats when a booking is cancelled.
   * On cancellation — release gender restriction on adjacent seat if no longer needed.
   */
  async _clearAdjacentGenderRestrictions(seatIds) {
    const seats = await pool.query(
      'SELECT id, seat_number, route_id FROM seats WHERE id = ANY($1)',
      [seatIds]
    );

    for (const seat of seats.rows) {
      const match = seat.seat_number.match(/^(\d+)([A-D])$/);
      if (!match) continue;

      const rowNum = match[1];
      const colLetter = match[2];
      const adjacency = { A: 'B', B: 'A', C: 'D', D: 'C' };
      const adjacentCol = adjacency[colLetter];
      if (!adjacentCol) continue;

      const adjacentSeatNumber = `${rowNum}${adjacentCol}`;

      // Check if adjacent seat is still booked
      const adjResult = await pool.query(
        `SELECT s.* FROM seats s
         WHERE s.route_id = $1 AND s.seat_number = $2`,
        [seat.route_id, adjacentSeatNumber]
      );

      if (adjResult.rows.length > 0 && adjResult.rows[0].status === 'available') {
        await pool.query(
          'UPDATE seats SET restricted_to_gender = NULL WHERE id = $1',
          [adjResult.rows[0].id]
        );
        console.log(`[BookingService] Cleared gender restriction on adjacent seat ${adjacentSeatNumber}`);
      }
    }
  }

  /**
   * Get all bookings (admin).
   */
  async getAllBookings() {
    const result = await pool.query(
      `SELECT b.*, u.name as user_name, u.email as user_email,
              r.departure_time, r.arrival_time, r.travel_date,
              oc.name as origin_city, dc.name as destination_city,
              bus.name as bus_name
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN routes r ON b.route_id = r.id
       JOIN cities oc ON r.origin_city_id = oc.id
       JOIN cities dc ON r.destination_city_id = dc.id
       JOIN buses bus ON r.bus_id = bus.id
       ORDER BY b.created_at DESC
       LIMIT 100`
    );
    return result.rows;
  }
}

module.exports = new BookingService();
module.exports.ConflictError = ConflictError;
