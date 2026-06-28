import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bus,
  MapPin,
  Calendar,
  Clock,
  IndianRupee,
  XCircle,
  ChevronRight,
  Ticket,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';

interface Booking {
  id: string;
  route_id: string;
  seat_ids: string[];
  passenger_names: string[];
  seat_numbers: string[];
  total_fare: number;
  status: string;
  created_at: string;
  departure_time: string;
  arrival_time: string;
  travel_date: string;
  origin_city: string;
  destination_city: string;
  bus_name: string;
  bus_number: string;
}

interface RefundInfo {
  refundPercentage: number;
  refundAmount: number;
  tierName: string;
  description: string;
  hoursUntilDeparture: number;
}

interface RefundResult {
  bookingId: string;
  status: string;
  refund: {
    amount: number;
    percentage: number;
    tierName: string;
    description: string;
    estimatedProcessingDays: number | null;
    refundStatus: string;
  };
}

interface RefundRecord {
  id: string;
  booking_id: string;
  original_fare: number;
  refund_percentage: number;
  refund_amount: number;
  tier_name: string;
  status: string;
  initiated_at: string;
  processed_at: string | null;
  failure_reason: string | null;
  origin_city: string;
  destination_city: string;
  passenger_names: string[];
}

export default function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [refundInfo, setRefundInfo] = useState<RefundInfo | null>(null);
  const [refundResult, setRefundResult] = useState<RefundResult | null>(null);
  const [refundRecords, setRefundRecords] = useState<RefundRecord[]>([]);
  const [showRefundHistory, setShowRefundHistory] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) return;
    fetchBookings();
    fetchRefundHistory();
  }, [isAuthenticated]);

  const fetchBookings = async () => {
    try {
      const response = await api.get('/api/bookings/my');
      setBookings(response.data.bookings);
    } catch (error: any) {
      toast.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const fetchRefundHistory = async () => {
    try {
      const response = await api.get('/api/bookings/refunds');
      setRefundRecords(response.data.refunds);
    } catch (e) {
      // Ignore
    }
  };

  const openCancelDialog = async (bookingId: string) => {
    setCancelDialog(bookingId);
    setRefundResult(null);
    // Fetch refund calculation
    try {
      const booking = bookings.find((b) => b.id === bookingId);
      if (booking) {
        const [h, m] = booking.departure_time.split(':').map(Number);
        const depDate = new Date(booking.travel_date);
        depDate.setHours(h, m, 0, 0);
        const diffMs = depDate.getTime() - Date.now();
        const hoursUntil = Math.max(0, diffMs / (1000 * 60 * 60));

        // Simple client-side calculation matching server tiers
        let tier: RefundInfo;
        if (hoursUntil >= 48) {
          tier = { refundPercentage: 100, refundAmount: booking.total_fare, tierName: 'Full Refund', description: 'Cancelled more than 48 hours before departure — full refund', hoursUntilDeparture: Math.round(hoursUntil * 10) / 10 };
        } else if (hoursUntil >= 24) {
          tier = { refundPercentage: 75, refundAmount: parseFloat(((booking.total_fare * 75) / 100).toFixed(2)), tierName: 'Partial Refund 75%', description: 'Cancelled 24–48 hours before departure — 75% refund', hoursUntilDeparture: Math.round(hoursUntil * 10) / 10 };
        } else if (hoursUntil >= 12) {
          tier = { refundPercentage: 50, refundAmount: parseFloat(((booking.total_fare * 50) / 100).toFixed(2)), tierName: 'Partial Refund 50%', description: 'Cancelled 12–24 hours before departure — 50% refund', hoursUntilDeparture: Math.round(hoursUntil * 10) / 10 };
        } else if (hoursUntil >= 4) {
          tier = { refundPercentage: 25, refundAmount: parseFloat(((booking.total_fare * 25) / 100).toFixed(2)), tierName: 'Partial Refund 25%', description: 'Cancelled 4–12 hours before departure — 25% refund', hoursUntilDeparture: Math.round(hoursUntil * 10) / 10 };
        } else {
          tier = { refundPercentage: 0, refundAmount: 0, tierName: 'No Refund', description: 'Cancelled less than 4 hours before departure — no refund', hoursUntilDeparture: Math.round(hoursUntil * 10) / 10 };
        }
        setRefundInfo(tier);
      }
    } catch (e) {
      setRefundInfo(null);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setCancelling(true);
    try {
      const response = await api.patch(`/api/bookings/${bookingId}/cancel`);
      const result = response.data;
      setRefundResult(result);
      if (result.refund?.refundStatus === 'processed') {
        toast.success(`Booking cancelled. ₹${result.refund.amount} refund will be credited in 3–5 business days.`);
      } else if (result.refund?.refundStatus === 'failed') {
        toast.error(`Cancellation processed but refund failed. Please contact support with booking ID ${bookingId}.`);
      } else {
        toast.success('Booking cancelled successfully');
      }
      setCancelDialog(null);
      fetchBookings();
      fetchRefundHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const formatDate = (date: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="badge-confirmed">Confirmed</span>;
      case 'cancelled':
        return <span className="badge-cancelled">Cancelled</span>;
      case 'pending':
        return <span className="badge-pending">Pending</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const getRefundStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return <span className="badge-confirmed">Processed</span>;
      case 'failed':
        return <span className="badge-cancelled">Failed</span>;
      case 'pending':
        return <span className="badge-pending">Pending</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="spinner !w-10 !h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Bookings</h1>
            <p className="text-text-secondary mt-1">
              {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowRefundHistory(!showRefundHistory)}
            className="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {showRefundHistory ? 'Hide Refunds' : 'Refund History'}
          </button>
        </div>

        {/* Refund History Section */}
        {showRefundHistory && (
          <div className="card p-5 mb-6 animate-slide-up">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-teal-400" />
              Refund History
            </h3>
            {refundRecords.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-sm">
                No refunds yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-2 text-text-secondary font-medium">Booking ID</th>
                      <th className="text-left p-2 text-text-secondary font-medium">Route</th>
                      <th className="text-left p-2 text-text-secondary font-medium">Cancelled On</th>
                      <th className="text-left p-2 text-text-secondary font-medium">Refund Amount</th>
                      <th className="text-left p-2 text-text-secondary font-medium">%</th>
                      <th className="text-left p-2 text-text-secondary font-medium">Status</th>
                      <th className="text-left p-2 text-text-secondary font-medium">Processing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundRecords.map((rec) => (
                      <tr key={rec.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="p-2 font-mono text-xs">{rec.booking_id.slice(0, 8)}...</td>
                        <td className="p-2 text-xs">{rec.origin_city} → {rec.destination_city}</td>
                        <td className="p-2 text-xs">{formatDate(rec.initiated_at)}</td>
                        <td className="p-2 text-xs font-medium">₹{rec.refund_amount}</td>
                        <td className="p-2 text-xs">{rec.refund_percentage}%</td>
                        <td className="p-2">{getRefundStatusBadge(rec.status)}</td>
                        <td className="p-2 text-xs text-text-secondary">
                          {rec.status === 'processed' ? '3 days' : rec.status === 'failed' ? 'Failed' : 'Pending'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="card p-12 text-center">
            <Ticket className="w-16 h-16 text-text-secondary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No bookings yet</h3>
            <p className="text-text-secondary mb-6">
              Start your journey with RapidRoute
            </p>
            <Link to="/" className="btn-primary inline-flex items-center gap-2">
              <Bus className="w-5 h-5" />
              Book a Bus
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.id} className="card p-6 animate-slide-up">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Bus className="w-5 h-5 text-teal-400" />
                      <span className="font-semibold">{booking.bus_name}</span>
                      <span className="text-xs text-text-secondary">
                        {booking.bus_number}
                      </span>
                      {getStatusBadge(booking.status)}
                    </div>

                    <div className="flex items-center gap-2 text-sm mb-2">
                      <MapPin className="w-4 h-4 text-text-secondary" />
                      <span className="font-medium">{booking.origin_city}</span>
                      <ChevronRight className="w-4 h-4 text-text-secondary" />
                      <span className="font-medium">{booking.destination_city}</span>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(booking.travel_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(booking.departure_time)}
                      </span>
                      <span className="flex items-center gap-1">
                        <IndianRupee className="w-3.5 h-3.5" />
                        ₹{booking.total_fare}
                      </span>
                    </div>

                    {booking.passenger_names && booking.passenger_names.length > 0 && (
                      <p className="text-xs text-text-secondary mt-2">
                        Passengers: {booking.passenger_names.join(', ')}
                      </p>
                    )}
                    {booking.seat_numbers && booking.seat_numbers.length > 0 && (
                      <p className="text-xs font-medium mt-1 flex items-center gap-1">
                        <span className="text-text-secondary">Seats:</span>
                        <span className="text-teal-400">{booking.seat_numbers.join(', ')}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Link
                      to={`/confirmation/${booking.id}`}
                      className="btn-secondary text-sm px-4 py-2"
                    >
                      View
                    </Link>
                    {booking.status === 'confirmed' && (
                      <button
                        onClick={() => openCancelDialog(booking.id)}
                        className="btn-danger text-sm px-4 py-2 flex items-center gap-1"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cancel Confirmation Dialog with Refund Info */}
        {cancelDialog && refundInfo && !refundResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setCancelDialog(null)} />
            <div className="relative bg-navy-900 rounded-xl p-6 max-w-md w-full border border-white/10 animate-slide-up">
              <h3 className="text-lg font-semibold mb-2">Cancel Booking?</h3>
              <p className="text-sm text-text-secondary mb-4">
                Based on your cancellation timing, you qualify for:
              </p>

              <div className="p-4 rounded-xl bg-navy-800 border border-white/10 mb-4">
                <p className="text-lg font-bold text-teal-400 mb-1">
                  {refundInfo.tierName}
                </p>
                <p className="text-xs text-text-secondary mb-3">
                  {refundInfo.description}
                </p>

                <div className="border-t border-white/10 pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Original Fare</span>
                    <span className="font-medium">₹{(bookings.find(b => b.id === cancelDialog)?.total_fare || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Refund Percentage</span>
                    <span className="font-medium">{refundInfo.refundPercentage}%</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-text-secondary">Refund Amount</span>
                    <span className="text-teal-400">₹{refundInfo.refundAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <p className="text-xs text-text-secondary mt-3">
                  ₹{refundInfo.refundAmount.toLocaleString('en-IN')} will be refunded to your original payment method within 3–5 business days.
                </p>

                {refundInfo.refundPercentage === 0 && (
                  <div className="mt-3 p-2 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">
                      No refund is applicable as the departure is less than 4 hours away.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCancelDialog(null);
                    setRefundInfo(null);
                  }}
                  className="btn-secondary flex-1"
                  disabled={cancelling}
                >
                  Keep My Booking
                </button>
                <button
                  onClick={() => handleCancelBooking(cancelDialog)}
                  disabled={cancelling}
                  className="btn-danger flex-1 flex items-center justify-center gap-2"
                >
                  {cancelling ? (
                    <>
                      <span className="spinner !w-4 !h-4" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Cancellation'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Processing spinner overlay */}
        {cancelling && !cancelDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-navy-900 rounded-xl p-8 flex flex-col items-center gap-4 border border-white/10">
              <span className="spinner !w-8 !h-8" />
              <p className="text-sm text-text-secondary">Processing your cancellation...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
