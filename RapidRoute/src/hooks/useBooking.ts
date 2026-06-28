import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { generateIdempotencyKey } from '../utils/idempotency';
import { useBookingStore } from '../store/bookingStore';

interface UseBookingResult {
  bookingInProgress: boolean;
  idempotencyKey: string;
  confirmBooking: () => Promise<void>;
  processPayment: (bookingId: string) => Promise<boolean>;
  resetIdempotencyKey: () => void;
}

/**
 * Custom hook that manages the complete booking flow:
 * - Generates and maintains an idempotency key for the session
 * - Handles booking confirmation with conflict retry logic
 * - Handles payment processing
 */
export function useBooking(): UseBookingResult {
  const navigate = useNavigate();
  const { selectedSeats, passengerDetails, currentRouteId, currentRoute, clearBooking } =
    useBookingStore();

  const [idempotencyKey, setIdempotencyKey] = useState(generateIdempotencyKey);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const bookingIdRef = useRef<string | null>(null);

  const resetIdempotencyKey = useCallback(() => {
    setIdempotencyKey(generateIdempotencyKey());
  }, []);

  const confirmBooking = useCallback(async () => {
    if (!currentRouteId || selectedSeats.length === 0 || passengerDetails.length === 0) {
      toast.error('Missing booking details');
      return;
    }

    setBookingInProgress(true);

    try {
      const seatIds = selectedSeats.map((s) => s.id);
      const names = passengerDetails.map((p) => p.name);

      const response = await api.post(
        '/api/bookings/confirm',
        {
          routeId: currentRouteId,
          seatIds,
          passengerNames: names,
          idempotencyKey,
        },
        {
          headers: {
            'idempotency-key': idempotencyKey,
          },
        }
      );

      const booking = response.data.booking;
      bookingIdRef.current = booking.id;

      // Proceed to payment
      await processPayment(booking.id);
    } catch (error: any) {
      const errorData = error.response?.data;

      if (errorData?.type === 'ConflictError') {
        toast.error('Another booking was detected. Retrying safely...');
        // Retry with the same idempotency key (safe retry semantics)
        try {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await confirmBooking();
        } catch (retryError: any) {
          toast.error('Booking failed. Please try again.');
          setBookingInProgress(false);
        }
      } else {
        toast.error(errorData?.message || 'Booking failed. Please try again.');
        setBookingInProgress(false);
      }
    }
  }, [currentRouteId, selectedSeats, passengerDetails, idempotencyKey]);

  const processPayment = useCallback(
    async (bookingId: string): Promise<boolean> => {
      try {
        const paymentKey = generateIdempotencyKey();

        const response = await api.post(
          '/api/payments/process',
          {
            bookingId,
            idempotencyKey: paymentKey,
          },
          {
            headers: {
              'idempotency-key': paymentKey,
            },
          }
        );

        const { status } = response.data;

        if (status === 'success') {
          toast.success('Payment successful! 🎉');
          clearBooking();
          setBookingInProgress(false);
          navigate(`/confirmation/${bookingId}`);
          return true;
        } else {
          toast.error('Payment failed. Please try again.');
          setBookingInProgress(false);
          return false;
        }
      } catch (error: any) {
        toast.error('Payment processing error. Please try again.');
        setBookingInProgress(false);
        return false;
      }
    },
    [clearBooking, navigate]
  );

  return {
    bookingInProgress,
    idempotencyKey,
    confirmBooking,
    processPayment,
    resetIdempotencyKey,
  };
}
