import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

interface Seat {
  id: string;
  route_id: string;
  seat_number: string;
  deck: string;
  type: string;
  status: string;
  version: number;
  held_by?: string;
  held_until?: string;
  held_by_name?: string;
}

interface UseSeatsResult {
  seats: Seat[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Custom hook that polls GET /api/seats/:routeId every 5000ms
 * to refresh seat status in real time.
 */
export function useSeats(routeId: string | undefined): UseSeatsResult {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchSeats = useCallback(async () => {
    if (!routeId) return;

    try {
      const response = await api.get(`/api/seats/${routeId}`);
      if (mountedRef.current) {
        setSeats(response.data.seats);
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.response?.data?.error || 'Failed to fetch seats');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [routeId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchSeats();

    // Poll every 5000ms for real-time seat updates
    intervalRef.current = setInterval(fetchSeats, 5000);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchSeats]);

  return { seats, loading, error, refetch: fetchSeats };
}
