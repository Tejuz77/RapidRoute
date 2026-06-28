import { useState, useEffect, useCallback, useRef } from 'react';

interface UseCountdownResult {
  timeString: string;
  isExpired: boolean;
  minutesRemaining: number;
  secondsRemaining: number;
  totalSecondsRemaining: number;
}

/**
 * Custom hook that takes an endTime ISO string and returns MM:SS countdown.
 * Fires an optional callback when the countdown reaches zero.
 *
 * @param endTime ISO string or null
 * @param onExpiry Optional callback fired when countdown hits 0
 * @returns Countdown state
 */
export function useCountdown(
  endTime: string | null,
  onExpiry?: () => void
): UseCountdownResult {
  const [now, setNow] = useState(Date.now());
  const onExpiryRef = useRef(onExpiry);
  onExpiryRef.current = onExpiry;
  const expiredFiredRef = useRef(false);

  useEffect(() => {
    if (!endTime) return;

    expiredFiredRef.current = false;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  const endTimestamp = endTime ? new Date(endTime).getTime() : 0;
  const diff = endTimestamp - now;
  const totalSeconds = Math.max(0, Math.floor(diff / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const timeString =
    endTime && totalSeconds > 0
      ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : '00:00';

  // Fire expiry callback once
  useEffect(() => {
    if (totalSeconds <= 0 && endTime && !expiredFiredRef.current) {
      expiredFiredRef.current = true;
      onExpiryRef.current?.();
    }
  }, [totalSeconds, endTime]);

  return {
    timeString,
    isExpired: totalSeconds <= 0 && !!endTime,
    minutesRemaining: minutes,
    secondsRemaining: seconds,
    totalSecondsRemaining: totalSeconds,
  };
}
