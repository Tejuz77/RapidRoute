/**
 * SeatService — Concurrency-controlled seat management.
 *
 * Two concurrency patterns used together:
 * 1. Optimistic locking via version column prevents lost updates.
 * 2. Pessimistic lock via SELECT FOR UPDATE prevents dirty reads.
 */

const pool = require('../db/pool');

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class SeatService {
  /**
   * Hold selected seats for a user.
   * Uses both pessimistic and optimistic locking for safe concurrent seat booking.
   *
   * @param {string} userId - UUID of the user holding the seats
   * @param {string[]} seatIds - Array of seat UUIDs to hold
   * @param {string} routeId - UUID of the route
   * @param {Object} [options] - Optional parameters
   * @param {Array<{name: string, age: string, gender: string}>} [options.passengerDetails] - Passenger details for gender adjacency
   * @returns {Promise<Object>} Result with held seats and expiry time
   * @throws {ConflictError} If seats are no longer available
   */
  async holdSeats(userId, seatIds, routeId, options = {}) {
    const HOLD_DURATION = parseInt(process.env.HOLD_DURATION_MINUTES || '10', 10);
    const { passengerDetails } = options;

    return pool.transaction(async (client) => {
      // Step 1: Pessimistic lock — SELECT FOR UPDATE prevents dirty reads
      // This ensures no other transaction can modify these seats concurrently.
      const selectResult = await client.query(
        'SELECT * FROM seats WHERE id = ANY($1) FOR UPDATE',
        [seatIds]
      );

      if (selectResult.rows.length !== seatIds.length) {
        throw new ConflictError('Some seats do not exist');
      }

      // Verify all seats are available
      const unavailableSeats = selectResult.rows.filter(
        (seat) => seat.status !== 'available'
      );
      if (unavailableSeats.length > 0) {
        const unavailableNumbers = unavailableSeats.map((s) => s.seat_number);
        throw new ConflictError(
          `Seats no longer available: ${unavailableNumbers.join(', ')}`
        );
      }

      // Step 2: Optimistic locking via version column
      // Extract expected versions from the rows we just locked with FOR UPDATE.
      const expectedVersions = selectResult.rows.map((s) => s.version);

      const updateResult = await client.query(
        `UPDATE seats s
         SET status = 'held',
             held_by = $2,
             held_until = NOW() + ($4 * INTERVAL '1 minute'),
             version = s.version + 1
         FROM (SELECT unnest($1::uuid[]) AS id, unnest($3::int[]) AS expected_version) AS updates
         WHERE s.id = updates.id
           AND s.version = updates.expected_version
           AND s.status = 'available'
         RETURNING s.*`,
        [seatIds, userId, expectedVersions, HOLD_DURATION]
      );

      if (updateResult.rowCount !== seatIds.length) {
        await client.query('ROLLBACK');
        throw new ConflictError(
          'Optimistic lock failed — seats no longer available'
        );
      }

      // Gender adjacency rule — protects passengers by restricting the seat beside
      // a booked seat to the same gender. Applied after ALL seats in the current
      // booking are processed, so a mixed-gender group booking adjacent seats
      // always succeeds.
      if (passengerDetails && Array.isArray(passengerDetails) && passengerDetails.length > 0) {
        await this._applyGenderAdjacency(client, selectResult.rows, passengerDetails);
      }

      const heldUntil = new Date(Date.now() + HOLD_DURATION * 60 * 1000);

      console.log(
        `[SeatService] Held ${seatIds.length} seats for user ${userId} until ${heldUntil.toISOString()}`
      );

      return {
        heldSeats: updateResult.rows,
        heldUntil: heldUntil.toISOString(),
      };
    });
  }

  /**
   * Apply gender-based adjacency restrictions to seats beside booked seats.
   * Group booking exception — gender adjacency restrictions are applied after
   * all seats in the same booking are assigned, so a mixed-gender group booking
   * adjacent seats always succeeds.
   */
  async _applyGenderAdjacency(client, heldSeats, passengerDetails) {
    for (let i = 0; i < heldSeats.length && i < passengerDetails.length; i++) {
      const seat = heldSeats[i];
      const passenger = passengerDetails[i];

      if (!passenger.gender || passenger.gender === 'other') continue;
      if (passenger.gender !== 'male' && passenger.gender !== 'female') continue;

      // Find adjacent seat in the same row (2-2 layout: A-B gap C-D)
      const adjacentSeatNumber = this._getAdjacentSeatNumber(seat.seat_number);
      if (!adjacentSeatNumber) continue;

      // Check if adjacent seat is also being booked in this transaction
      const beingBookedInThisTx = heldSeats.some(
        (s) => s.seat_number === adjacentSeatNumber
      );
      if (beingBookedInThisTx) continue;

      // Lock the adjacent seat and update its restriction
      const adjResult = await client.query(
        `UPDATE seats
         SET restricted_to_gender = $1
         WHERE route_id = $2
           AND seat_number = $3
           AND (restricted_to_gender IS NULL OR restricted_to_gender = $1)
           AND status = 'available'
         RETURNING *`,
        [passenger.gender, seat.route_id, adjacentSeatNumber]
      );

      if (adjResult.rowCount > 0) {
        console.log(
          `[SeatService] Gender adjacency: seat ${adjacentSeatNumber} restricted to ${passenger.gender} (adjacent to ${seat.seat_number})`
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

    // 2-2 layout: A-B gap C-D
    const adjacency = { A: 'B', B: 'A', C: 'D', D: 'C' };
    const adjacentCol = adjacency[colLetter];
    if (!adjacentCol) return null;

    return `${rowNum}${adjacentCol}`;
  }

  /**
   * Manually release held seats.
   *
   * @param {string[]} seatIds - Array of seat UUIDs to release
   * @param {string} userId - UUID of the user holding them
   */
  async releaseSeats(seatIds, userId) {
    const result = await pool.query(
      `UPDATE seats
       SET status = 'available',
           held_by = NULL,
           held_until = NULL,
           version = version + 1
       WHERE id = ANY($1)
         AND held_by = $2
         AND status = 'held'
       RETURNING *`,
      [seatIds, userId]
    );

    console.log(`[SeatService] Released ${result.rowCount} seats for user ${userId}`);
    return result.rows;
  }

  /**
   * Release booked seats (for cancellations).
   * Booked seats don't have held_by set, so this uses a direct UPDATE
   * without status/held_by filters. Also clears gender restrictions.
   *
   * @param {string[]} seatIds - Array of seat UUIDs to release
   */
  async releaseBookedSeats(seatIds) {
    const result = await pool.query(
      `UPDATE seats
       SET status = 'available',
           held_by = NULL,
           held_until = NULL,
           restricted_to_gender = NULL,
           version = version + 1
       WHERE id = ANY($1)
       RETURNING *`,
      [seatIds]
    );

    console.log(`[SeatService] Released ${result.rowCount} booked seats`);
    return result.rows;
  }

  /**
   * Release seats by admin (no user check). Works for both held and booked.
   */
  async releaseSeatsAdmin(seatIds) {
    const result = await pool.query(
      `UPDATE seats
       SET status = 'available',
           held_by = NULL,
           held_until = NULL,
           restricted_to_gender = NULL,
           version = version + 1
       WHERE id = ANY($1)
       RETURNING *`,
      [seatIds]
    );

    console.log(`[SeatService] Released ${result.rowCount} seats (admin)`);
    return result.rows;
  }

  /**
   * Atomic bulk release of expired seat holds.
   *
   * Runs periodically via the hold expiry job to clean up stale holds.
   */
  async releaseExpiredHolds() {
    const result = await pool.query(
      `UPDATE seats
       SET status = 'available',
           held_by = NULL,
           held_until = NULL,
           version = version + 1
       WHERE status = 'held'
         AND held_until < NOW()
       RETURNING id, seat_number`
    );

    if (result.rowCount > 0) {
      console.log(
        `[SeatService] Released ${result.rowCount} expired holds: ${result.rows
          .map((r) => r.seat_number)
          .join(', ')}`
      );
    }

    return result.rows;
  }
}

module.exports = new SeatService();
module.exports.ConflictError = ConflictError;
