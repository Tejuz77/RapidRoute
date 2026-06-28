/**
 * Booking Window Utility — Prevents last-minute bookings that cause operational issues.
 *
 * Each route has a booking_cutoff_minutes value (default 60). Passengers cannot book
 * a seat after the cutoff time has passed relative to departure.
 *
 * @param {string} departureTime - HH:MM format
 * @param {string} travelDate - YYYY-MM-DD format
 * @param {number} cutoffMinutes - Minutes before departure to close booking
 * @returns {boolean} Whether booking is still open
 */
function isBookingOpen(departureTime, travelDate, cutoffMinutes) {
  const cutoffMs = getBookingClosesAt(departureTime, travelDate, cutoffMinutes);
  return Date.now() < cutoffMs;
}

/**
 * Get the exact DateTime when booking closes.
 * @param {string} departureTime - HH:MM format
 * @param {string} travelDate - YYYY-MM-DD format
 * @param {number} cutoffMinutes - Minutes before departure to close booking
 * @returns {number} Timestamp in milliseconds
 */
function getBookingClosesAt(departureTime, travelDate, cutoffMinutes) {
  const [hours, minutes] = departureTime.split(':').map(Number);
  const departureDateTime = new Date(travelDate);
  departureDateTime.setHours(hours, minutes, 0, 0);
  return departureDateTime.getTime() - cutoffMinutes * 60 * 1000;
}

/**
 * Get a human-readable string about when booking closes.
 * @param {string} departureTime - HH:MM format
 * @param {string} travelDate - YYYY-MM-DD format
 * @param {number} cutoffMinutes - Minutes before departure to close booking
 * @returns {string} Human-readable string
 */
function getTimeUntilClose(departureTime, travelDate, cutoffMinutes) {
  const closesAt = getBookingClosesAt(departureTime, travelDate, cutoffMinutes);
  const now = Date.now();

  if (now >= closesAt) {
    const minutesAgo = Math.floor((now - closesAt) / 60000);
    if (minutesAgo < 1) return 'Booking closed';
    return `Booking closed ${minutesAgo} min ago`;
  }

  const diffMs = closesAt - now;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;

  if (diffHours > 0) {
    return `Closes in ${diffHours} hr ${remainingMinutes} min`;
  }
  return `Closes in ${diffMinutes} min`;
}

/**
 * Get the booking window status object for API responses.
 * @param {string} departureTime - HH:MM format
 * @param {string} travelDate - YYYY-MM-DD format
 * @param {number} cutoffMinutes - Minutes before departure to close booking
 * @returns {Object} { bookingOpen, bookingClosesAt, timeUntilClose }
 */
function getBookingWindowStatus(departureTime, travelDate, cutoffMinutes) {
  const closesAt = new Date(getBookingClosesAt(departureTime, travelDate, cutoffMinutes));
  return {
    bookingOpen: isBookingOpen(departureTime, travelDate, cutoffMinutes),
    bookingClosesAt: closesAt.toISOString(),
    timeUntilClose: getTimeUntilClose(departureTime, travelDate, cutoffMinutes),
  };
}

module.exports = {
  isBookingOpen,
  getBookingClosesAt,
  getTimeUntilClose,
  getBookingWindowStatus,
};
