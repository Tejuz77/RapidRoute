import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Bus,
  MapPin,
  Calendar,
  Clock,
  User,
  IndianRupee,
  Download,
  Ticket,
  ArrowRight,
  QrCode,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function Confirmation() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookingDetails();
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    try {
      const response = await api.get('/api/bookings/my');
      const bookings = response.data.bookings;
      const found = bookings.find((b: any) => b.id === bookingId);
      if (found) {
        setBooking(found);
      }
    } catch (error) {
      console.error('Failed to fetch booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTicket = () => {
    toast.success('Ticket saved!');
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
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="spinner !w-10 !h-10" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Booking not found</h2>
          <Link to="/my-bookings" className="btn-primary">
            View My Bookings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="card p-8 text-center animate-fade-in">
          {/* Success Checkmark Animation */}
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-success/10 border-2 border-success/30 mx-auto flex items-center justify-center">
              <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="#22C55E"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="checkmark-animation"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-2">Booking Confirmed! 🎉</h1>
          <p className="text-text-secondary mb-8">
            Your bus tickets have been booked successfully
          </p>

          {/* Booking ID */}
          <div className="bg-navy-900 rounded-xl p-4 mb-6 border border-white/5">
            <p className="text-xs text-text-secondary mb-1">Booking ID</p>
            <p className="text-lg font-mono font-bold text-teal-400 break-all">
              {booking.id}
            </p>
          </div>

          {/* Trip Details */}
          <div className="space-y-4 mb-6 text-left">
            <div className="flex items-center gap-3">
              <Bus className="w-5 h-5 text-teal-400 flex-shrink-0" />
              <div>
                <p className="font-medium">{booking.bus_name}</p>
                <p className="text-xs text-text-secondary">{booking.bus_number}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-teal-400 flex-shrink-0" />
              <div>
                <p className="font-medium">
                  {booking.origin_city} → {booking.destination_city}
                </p>
                <p className="text-xs text-text-secondary">
                  {formatTime(booking.departure_time)} - {formatTime(booking.arrival_time)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-teal-400 flex-shrink-0" />
              <div>
                <p className="font-medium">{formatDate(booking.travel_date)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-teal-400 flex-shrink-0" />
              <div>
                <p className="font-medium">{booking.passenger_names?.join(', ')}</p>
                <p className="text-xs text-text-secondary">Passengers</p>
              </div>
            </div>
          </div>

          {/* QR Code Placeholder */}
          <div className="bg-white rounded-xl p-6 mb-6 flex flex-col items-center">
            <div className="w-32 h-32 bg-gradient-to-br from-teal-400/20 to-teal-500/20 rounded-xl border-2 border-teal-500/30 flex items-center justify-center mb-3">
              <QrCode className="w-16 h-16 text-teal-400" />
            </div>
            <p className="text-xs text-gray-500">Scan for ticket verification</p>
          </div>

          {/* Total Amount */}
          <div className="bg-navy-900 rounded-xl p-4 mb-8 border border-white/5">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Total Amount Paid</span>
              <span className="text-2xl font-bold text-teal-400">
                ₹{booking.total_fare}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleDownloadTicket}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download Ticket
            </button>

            <Link
              to="/my-bookings"
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Ticket className="w-5 h-5" />
              View My Bookings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
