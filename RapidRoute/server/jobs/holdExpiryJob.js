/**
 * Hold Expiry Job — Periodic cleanup of expired seat holds.
 *
 * Runs every 60 seconds, releasing seats where the hold has expired.
 * Uses async-mutex to ensure only one async fiber updates the in-memory
 * seat cache at a time, preventing race conditions on the cache.
 */

const { Mutex } = require('async-mutex');
const SeatService = require('../services/SeatService');

// Mutex ensures only one async fiber updates the in-memory seat cache at a time.
const seatCacheMutex = new Mutex();

/**
 * In-memory seat cache (simplified for demo purposes).
 * In production, this would be Redis or similar.
 */
const seatCache = {
  data: new Map(),
  lastUpdated: null,

  update(seats) {
    for (const seat of seats) {
      this.data.set(seat.id, { ...seat, cachedAt: Date.now() });
    }
    this.lastUpdated = Date.now();
  },

  invalidate(seatIds) {
    for (const id of seatIds) {
      this.data.delete(id);
    }
  },

  get(seatId) {
    return this.data.get(seatId);
  },
};

/**
 * Start the hold expiry job.
 * Runs every 60 seconds to release expired seat holds.
 */
function startHoldExpiryJob() {
  console.log('[HoldExpiryJob] Started — checking for expired holds every 60 seconds');

  setInterval(async () => {
    try {
      const releasedSeats = await SeatService.releaseExpiredHolds();

      if (releasedSeats.length > 0) {
        // Mutex: only one fiber can update the seat cache at a time.
        // This prevents concurrent cache updates from different job iterations.
        await seatCacheMutex.runExclusive(async () => {
          const releasedIds = releasedSeats.map((s) => s.id);
          seatCache.invalidate(releasedIds);
          console.log(
            `[HoldExpiryJob] Released ${releasedSeats.length} expired holds at ${new Date().toISOString()}`
          );
          console.log(
            `[HoldExpiryJob] Seats released: ${releasedSeats.map((s) => s.seat_number).join(', ')}`
          );
        });
      }
    } catch (error) {
      console.error('[HoldExpiryJob] Error releasing expired holds:', error.message);
    }
  }, 60000);
}

/**
 * Get stats about the seat cache.
 */
function getCacheStats() {
  return {
    size: seatCache.data.size,
    lastUpdated: seatCache.lastUpdated,
  };
}

module.exports = { startHoldExpiryJob, getCacheStats, seatCache };
