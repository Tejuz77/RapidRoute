import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  Lock,
  ArrowLeft,
  IndianRupee,
  Shield,
  Info,
  Bus,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBookingStore } from '../store/bookingStore';
import { useAuthStore } from '../store/authStore';
import { useBooking } from '../hooks/useBooking';
import api from '../utils/api';
import { generateIdempotencyKey } from '../utils/idempotency';

interface PassengerForm {
  name: string;
  age: string;
  gender: string;
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeFromState = (location.state as any)?.route;
  const {
    selectedSeats,
    holdExpiry,
    currentRoute,
    clearBooking,
    setPassengerDetails,
    setCurrentRoute,
  } = useBookingStore();
  const { user } = useAuthStore();

  // Use route from state (passed from SeatSelection) or from store
  const route = routeFromState || currentRoute;

  // Store route info if passed via state
  useEffect(() => {
    if (routeFromState) {
      setCurrentRoute(routeFromState);
    }
  }, [routeFromState]);

  const [passengers, setPassengers] = useState<PassengerForm[]>([]);
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [processing, setProcessing] = useState(false);
  const [seatRestrictions, setSeatRestrictions] = useState<Record<string, string>>({});
  const [genderErrors, setGenderErrors] = useState<Record<string, string>>({});

  const idempotencyKey = useState(generateIdempotencyKey)[0];

  // Fetch gender restrictions for selected seats
  useEffect(() => {
    if (selectedSeats.length === 0) return;
    const fetchRestrictions = async () => {
      try {
        const res = await api.get(`/api/seats/${route?.id}`);
        const seatsData = res.data.seats || [];
        const restrictions: Record<string, string> = {};
        selectedSeats.forEach((seat) => {
          const found = seatsData.find((s: any) => s.id === seat.id);
          if (found && found.restricted_to_gender) {
            restrictions[seat.seat_number] = found.restricted_to_gender;
          }
        });
        setSeatRestrictions(restrictions);
      } catch (e) {
        // Ignore
      }
    };
    fetchRestrictions();
  }, [selectedSeats, route?.id]);

  useEffect(() => {
    if (selectedSeats.length === 0) {
      navigate('/');
      return;
    }
    setPassengers(
      selectedSeats.map(() => ({ name: '', age: '', gender: 'male' }))
    );
  }, [selectedSeats]);

  useEffect(() => {
    if (!holdExpiry) {
      toast.error('Seat hold has expired. Please select seats again.');
      navigate(-1);
    }
  }, [holdExpiry]);

  const updatePassenger = (index: number, field: keyof PassengerForm, value: string) => {
    setPassengers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const validateForm = () => {
    const newGenderErrors: Record<string, string> = {};

    for (let i = 0; i < passengers.length; i++) {
      if (!passengers[i].name || !passengers[i].age) {
        toast.error(`Please fill in details for passenger ${i + 1}`);
        return false;
      }
      if (parseInt(passengers[i].age) < 1 || parseInt(passengers[i].age) > 120) {
        toast.error(`Invalid age for passenger ${i + 1}`);
        return false;
      }

      // Gender validation against seat restriction
      const seatNum = selectedSeats[i]?.seat_number;
      if (seatNum && seatRestrictions[seatNum]) {
        const requiredGender = seatRestrictions[seatNum];
        if (passengers[i].gender !== requiredGender) {
          const errMsg = `Seat ${seatNum} is reserved for ${requiredGender} passengers only. Please select a different seat.`;
          newGenderErrors[seatNum] = errMsg;
        }
      }
    }

    if (Object.keys(newGenderErrors).length > 0) {
      setGenderErrors(newGenderErrors);
      const firstErr = Object.values(newGenderErrors)[0];
      toast.error(firstErr);
      return false;
    }

    if (!phone) {
      toast.error('Please enter your phone number');
      return false;
    }
    if (!email) {
      toast.error('Please enter your email');
      return false;
    }
    return true;
  };

  const handleConfirmAndPay = async () => {
    if (!validateForm()) return;

    setProcessing(true);

    try {
      setPassengerDetails(
        passengers.map((p) => ({
          name: p.name,
          age: p.age,
          gender: p.gender,
        }))
      );

      const seatIds = selectedSeats.map((s) => s.id);
      const passengerNames = passengers.map((p) => p.name);
      const passengerGenders = passengers.map((p) => p.gender);

      // Step 1: Confirm booking
      const bookingResponse = await api.post(
        '/api/bookings/confirm',
        {
          routeId: route?.id,
          seatIds,
          passengerNames,
          passengerGenders,
          idempotencyKey,
        },
        {
          headers: { 'idempotency-key': idempotencyKey },
        }
      );

      const bookingId = bookingResponse.data.booking?.id;

      if (!bookingId) {
        throw new Error('No booking ID returned');
      }

      // Step 2: Process payment
      const paymentKey = generateIdempotencyKey();
      const paymentResponse = await api.post(
        '/api/payments/process',
        {
          bookingId,
          idempotencyKey: paymentKey,
        },
        {
          headers: { 'idempotency-key': paymentKey },
        }
      );

      if (paymentResponse.data.status === 'success') {
        toast.success('Booking confirmed! 🎉');
        clearBooking();
        navigate(`/confirmation/${bookingId}`);
      } else {
        toast.error('Payment failed. Please try again.');
        setProcessing(false);
      }
    } catch (error: any) {
      if (
        error.response?.data?.type === 'ConflictError' ||
        error.response?.status === 409
      ) {
        toast.error('Another booking was detected. Retrying safely...');

        // Retry with same idempotency key
        try {
          await new Promise((resolve) => setTimeout(resolve, 2000));            const retryResponse = await api.post(
            '/api/bookings/confirm',
            {
              routeId: route?.id,
              seatIds: selectedSeats.map((s) => s.id),
              passengerNames: passengers.map((p) => p.name),
              passengerGenders: passengers.map((p) => p.gender),
              idempotencyKey,
            },
            {
              headers: { 'idempotency-key': idempotencyKey },
            }
          );

          const retryBookingId = retryResponse.data.booking?.id;

          if (retryBookingId) {
            const retryPaymentKey = generateIdempotencyKey();
            const retryPaymentResponse = await api.post(
              '/api/payments/process',
              {
                bookingId: retryBookingId,
                idempotencyKey: retryPaymentKey,
              },
              {
                headers: { 'idempotency-key': retryPaymentKey },
              }
            );

            if (retryPaymentResponse.data.status === 'success') {
              toast.success('Booking confirmed on retry! 🎉');
              clearBooking();
              navigate(`/confirmation/${retryBookingId}`);
              return;
            }
          }
        } catch (retryError) {
          toast.error('Booking failed after retry. Please try again.');
        }
      } else {
        toast.error(error.response?.data?.message || 'Booking failed. Please try again.');
      }
      setProcessing(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 2) {
      return digits.slice(0, 2) + '/' + digits.slice(2);
    }
    return digits;
  };

  const totalFare = selectedSeats.length * (route?.fare || 0);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Passenger Details</h1>
            <p className="text-text-secondary text-sm">
              Complete your booking for {selectedSeats.length} seat(s)
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Passenger Details */}
          {passengers.map((passenger, index) => (
            <div key={index} className="card p-6 animate-slide-up">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-teal-400" />
                Passenger {index + 1} — Seat {selectedSeats[index]?.seat_number}
              </h3>

              {/* Gender restriction info badge */}
              {(() => {
                const seatNum = selectedSeats[index]?.seat_number;
                if (seatNum && seatRestrictions[seatNum]) {
                  return (
                    <div className="mb-3 p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center gap-2 text-xs text-teal-400">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      This seat requires a {seatRestrictions[seatNum]} passenger.
                    </div>
                  );
                }
                return null;
              })()}

              {/* Gender error */}
              {(() => {
                const seatNum = selectedSeats[index]?.seat_number;
                if (seatNum && genderErrors[seatNum]) {
                  return (
                    <div className="mb-3 p-2 rounded-lg bg-error/10 border border-error/30 flex items-center gap-2 text-xs text-error">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {genderErrors[seatNum]}
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={passenger.name}
                    onChange={(e) => updatePassenger(index, 'name', e.target.value)}
                    placeholder="Passenger name"
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Age *
                  </label>
                  <input
                    type="number"
                    value={passenger.age}
                    onChange={(e) => updatePassenger(index, 'age', e.target.value)}
                    placeholder="Age"
                    min="1"
                    max="120"
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Gender
                  </label>
                  <select
                    value={passenger.gender}
                    onChange={(e) => updatePassenger(index, 'gender', e.target.value)}
                    className={`select-field text-sm ${
                      (() => {
                        const seatNum = selectedSeats[index]?.seat_number;
                        if (seatNum && seatRestrictions[seatNum]) {
                          return passenger.gender === seatRestrictions[seatNum] ? 'border-success/50' : 'border-error/50';
                        }
                        return '';
                      })()
                    }`}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {(() => {
                    const seatNum = selectedSeats[index]?.seat_number;
                    if (seatNum && seatRestrictions[seatNum] && passenger.gender !== seatRestrictions[seatNum]) {
                      return (
                        <p className="text-[10px] text-error mt-1">
                          Required: {seatRestrictions[seatNum]}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          ))}

          {/* Contact Details */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-teal-400" />
              Contact Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91-9876543210"
                    className="input-field pl-9 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input-field pl-9 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Form - Demo Mode */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-teal-400" />
              Payment Details
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 font-normal border border-teal-500/30">
                <Sparkles className="w-3 h-3 inline mr-0.5" />
                Demo Mode
              </span>
            </h3>

            <div className="mb-4 p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 flex items-start gap-3">
              <Info className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary">
                This is a <strong className="text-teal-400">demo payment simulation</strong> — no real charges.
                Uses idempotency key <code className="text-teal-400 text-[10px] bg-navy-900 px-1 py-0.5 rounded">
                  {idempotencyKey.slice(0, 8)}...
                </code> to prevent duplicate charges.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Card Number
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="4242 4242 4242 4242"
                    className="input-field pl-9 text-sm font-mono"
                    autoComplete="off"
                  />
                  {cardNumber === '4242 4242 4242 4242' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded">
                      Test Card
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Expiry
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      className="input-field pl-9 text-sm font-mono"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    CVV
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      placeholder="123"
                      className="input-field pl-9 text-sm font-mono"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary & Action */}
          <div className="card p-6">
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Seats</span>
                <span>{selectedSeats.map((s) => s.seat_number).join(', ')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Fare per seat</span>
                <span>₹{route?.fare || 0}</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between font-semibold text-lg">
                <span>Total Amount</span>
                <span className="text-teal-400">₹{totalFare}</span>
              </div>
            </div>              <div className="flex items-center gap-2 text-xs text-text-secondary mb-4 p-3 rounded-xl bg-navy-900/50 border border-white/5">
              <Shield className="w-4 h-4 text-teal-400 flex-shrink-0" />
              <span>Payment is <strong className="text-teal-400">idempotent</strong> — same key = no duplicate charges. <strong className="text-teal-400">95% success rate</strong> simulated.</span>
            </div>

            <button
              onClick={handleConfirmAndPay}
              disabled={processing}
              className="btn-primary w-full text-lg py-4"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="spinner !w-6 !h-6" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <IndianRupee className="w-5 h-5" />
                  Confirm & Pay ₹{totalFare}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
