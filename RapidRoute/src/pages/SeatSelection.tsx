import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Bus,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Armchair,
  ShipWheel,
  DoorOpen,
  Timer,
  Info,
  Users,
  Clock,
  Bed,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useSeats } from '../hooks/useSeats';
import { useCountdown } from '../hooks/useCountdown';
import { useBookingStore } from '../store/bookingStore';
import { useAuthStore } from '../store/authStore';

interface RouteInfo {
  id: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  fare: number;
  travel_date: string;
  origin_city: string;
  destination_city: string;
  bus_name: string;
  bus_type: string;
  bus_number: string;
}

interface Seat {
  id: string;
  seat_number: string;
  deck: 'lower' | 'upper';
  type: 'window' | 'aisle';
  status: 'available' | 'held' | 'booked';
  version: number;
  held_by?: string;
  held_until?: string;
  held_by_name?: string;
  route_id: string;
  restricted_to_gender?: string | null;
  booked_passenger_names?: string[];
  passenger_gender?: string | null;
  booked_by_user?: string;
}

// ───────────────────────────────────────
// Sleeper bed SVG component (for Sleeper buses)
// ───────────────────────────────────────
/** Get gender-specific color for a seat */
function getGenderColor(gender?: string | null, defaultColor = '#EF4444'): string {
  if (gender === 'male') return '#3B82F6';
  if (gender === 'female') return '#EC4899';
  return defaultColor;
}

function getGenderRgba(gender: string | undefined | null, alpha: string, defaultRgba = 'rgba(239,68,68,'): string {
  if (gender === 'male') return `rgba(59,130,246,${alpha})`;
  if (gender === 'female') return `rgba(236,72,153,${alpha})`;
  return `${defaultRgba}${alpha})`;
}

function SleeperBedSvg({
  isBooked,
  isHeld,
  isSelected,
  seatLetter,
  isWindow,
  passengerGender,
  restrictedGender,
}: {
  isBooked: boolean;
  isHeld: boolean;
  isSelected: boolean;
  seatLetter: string;
  isWindow: boolean;
  passengerGender?: string | null;
  restrictedGender?: string | null;
}) {
  const baseColor = isBooked
    ? getGenderColor(passengerGender)
    : restrictedGender && !isHeld && !isSelected
    ? getGenderColor(restrictedGender)
    : isHeld
    ? '#F59E0B'
    : isSelected
    ? '#00C2A8'
    : '#22C55E';
  const bedFill = isBooked
    ? getGenderRgba(passengerGender, '0.2')
    : restrictedGender && !isHeld && !isSelected
    ? getGenderRgba(restrictedGender, '0.2')
    : isHeld
    ? 'rgba(245,158,11,0.2)'
    : isSelected
    ? 'rgba(0,194,168,0.2)'
    : 'rgba(34,197,94,0.12)';
  const strokeColor = isBooked
    ? getGenderRgba(passengerGender, '0.6')
    : restrictedGender && !isHeld && !isSelected
    ? getGenderRgba(restrictedGender, '0.6')
    : isHeld
    ? 'rgba(245,158,11,0.6)'
    : isSelected
    ? 'rgba(0,194,168,0.9)'
    : 'rgba(34,197,94,0.5)';

  const xColor = passengerGender === 'male' ? '#3B82F6' : passengerGender === 'female' ? '#EC4899' : '#EF4444';

  return (
    <svg
      viewBox="0 0 100 80"
      className="w-full h-full"
      fill="none"
    >
      {/* Bed platform */}
      <rect
        x="5"
        y="20"
        width="90"
        height="55"
        rx="6"
        fill={bedFill}
        stroke={strokeColor}
        strokeWidth="2"
      />
      {/* Pillow */}
      <rect
        x="8"
        y="22"
        width="30"
        height="20"
        rx="5"
        fill={isSelected ? 'rgba(0,194,168,0.3)' : isBooked ? getGenderRgba(passengerGender, '0.3') : isHeld ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.2)'}
        stroke={strokeColor}
        strokeWidth="1"
      />
      {/* Blanket lines */}
      <line x1="42" y1="50" x2="88" y2="50" stroke={strokeColor} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.3" />
      <line x1="42" y1="60" x2="88" y2="60" stroke={strokeColor} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.3" />
      {/* Curtain hint */}
      <rect x="90" y="5" width="8" height="70" rx="3" fill={bedFill} stroke={strokeColor} strokeWidth="1" opacity="0.6" />
      {/* Seat/Bed number label */}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fill={baseColor}
        fontSize="22"
        fontWeight="700"
        fontFamily="Inter, sans-serif"
        opacity={isBooked || isHeld ? 0.5 : 1}
      >
        {seatLetter}
      </text>
      {/* Bed icon */}
      <text x="8" y="68" fontSize="10" opacity="0.4">🛏️</text>
      {/* Window indicator */}
      {isWindow && (
        <rect x="0" y="8" width="4" height="40" rx="2" fill={baseColor} opacity="0.3" />
      )}
      {/* ✕ icon for booked */}
      {isBooked && (
        <line x1="35" y1="45" x2="65" y2="68" stroke={xColor} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      )}
      {/* Selected glow */}
      {isSelected && (
        <circle cx="50" cy="75" r="3" fill="#00C2A8" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

// ───────────────────────────────────────
// Realistic bus seat SVG component (for Seater/Semi-Sleeper)
// ───────────────────────────────────────
function BusSeatSvg({
  isBooked,
  isHeld,
  isSelected,
  seatLetter,
  isWindow,
  passengerGender,
  restrictedGender,
}: {
  isBooked: boolean;
  isHeld: boolean;
  isSelected: boolean;
  seatLetter: string;
  isWindow: boolean;
  passengerGender?: string | null;
  restrictedGender?: string | null;
}) {
  const baseColor = isBooked
    ? getGenderColor(passengerGender)
    : restrictedGender && !isHeld && !isSelected
    ? getGenderColor(restrictedGender)
    : isHeld
    ? '#F59E0B'
    : isSelected
    ? '#00C2A8'
    : '#22C55E';
  const seatFill = isBooked
    ? getGenderRgba(passengerGender, '0.25')
    : restrictedGender && !isHeld && !isSelected
    ? getGenderRgba(restrictedGender, '0.15')
    : isHeld
    ? 'rgba(245,158,11,0.25)'
    : isSelected
    ? 'rgba(0,194,168,0.25)'
    : 'rgba(34,197,94,0.15)';
  const strokeColor = isBooked
    ? getGenderRgba(passengerGender, '0.6')
    : restrictedGender && !isHeld && !isSelected
    ? getGenderRgba(restrictedGender, '0.6')
    : isHeld
    ? 'rgba(245,158,11,0.6)'
    : isSelected
    ? 'rgba(0,194,168,0.9)'
    : 'rgba(34,197,94,0.5)';

  const xColor = passengerGender === 'male' ? '#3B82F6' : passengerGender === 'female' ? '#EC4899' : '#EF4444';

  return (
    <svg
      viewBox="0 0 100 110"
      className="w-full h-full"
      fill="none"
    >
      {/* Seat cushion (bottom) */}
      <rect
        x="8"
        y="55"
        width="84"
        height="42"
        rx="8"
        fill={seatFill}
        stroke={strokeColor}
        strokeWidth="2.5"
      />
      {/* Seat backrest (top) */}
      <rect
        x="12"
        y="5"
        width="76"
        height="52"
        rx="10"
        fill={seatFill}
        stroke={strokeColor}
        strokeWidth="2.5"
      />
      {/* Headrest */}
      <rect
        x="20"
        y="5"
        width="60"
        height="14"
        rx="6"
        fill={isSelected ? 'rgba(0,194,168,0.35)' : isBooked ? getGenderRgba(passengerGender, '0.35') : isHeld ? 'rgba(245,158,11,0.35)' : 'rgba(34,197,94,0.25)'}
        stroke={strokeColor}
        strokeWidth="1.5"
      />
      {/* Seat backrest crease line */}
      <line
        x1="18"
        y1="30"
        x2="82"
        y2="30"
        stroke={strokeColor}
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.4"
      />
      {/* Armrest left */}
      <rect
        x="4"
        y="30"
        width="8"
        height="30"
        rx="3"
        fill={seatFill}
        stroke={strokeColor}
        strokeWidth="1.5"
      />
      {/* Armrest right */}
      <rect
        x="88"
        y="30"
        width="8"
        height="30"
        rx="3"
        fill={seatFill}
        stroke={strokeColor}
        strokeWidth="1.5"
      />
      {/* Seat number label */}
      <text
        x="50"
        y="80"
        textAnchor="middle"
        fill={baseColor}
        fontSize="28"
        fontWeight="700"
        fontFamily="Inter, sans-serif"
        opacity={isBooked || isHeld ? 0.5 : 1}
      >
        {seatLetter}
      </text>
      {/* Window indicator */}
      {isWindow && (
        <>
          <rect x="0" y="12" width="5" height="40" rx="2.5" fill={baseColor} opacity="0.3" />
          <rect x="95" y="12" width="5" height="40" rx="2.5" fill={baseColor} opacity="0.3" />
        </>
      )}
      {/* ✕ icon for booked seats */}
      {isBooked && (
        <line x1="35" y1="65" x2="65" y2="95" stroke={xColor} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      )}
      {/* Selected glow dots */}
      {isSelected && (
        <>
          <circle cx="50" cy="105" r="3" fill="#00C2A8" opacity="0.5">
            <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </svg>
  );
}

// ───────────────────────────────────────
// Bus Seat Button Component
// ───────────────────────────────────────
function BusSeatButton({
  seat,
  isSelected,
  onClick,
  isSleeper,
  currentUserId,
  onRelease,
}: {
  seat: Seat;
  isSelected: boolean;
  onClick: () => void;
  isSleeper: boolean;
  currentUserId?: string;
  onRelease?: (seatId: string) => void;
}) {
  const isBooked = seat.status === 'booked';
  const isHeld = seat.status === 'held' && !!seat.held_by_name;
  const isHeldByMe = seat.status === 'held' && seat.held_by === currentUserId;
  const isDisabled = isBooked || (isHeld && !isHeldByMe);
  const isWindow = seat.type === 'window';
  // Extract letter from seat_number (e.g., "1A" → "A")
  const seatLetter = seat.seat_number.slice(-1);
  const hasGenderRestriction = !!seat.restricted_to_gender;
  const restrictedGender = seat.restricted_to_gender;
  const bookedPassengerGender = seat.passenger_gender;

  const getGenderColorClass = (gender?: string | null): string => {
    if (gender === 'male') return 'text-blue-400';
    if (gender === 'female') return 'text-pink-400';
    return 'text-error';
  };

  const getGenderBorderClass = (gender?: string | null): string => {
    if (gender === 'male') return 'ring-blue-500/30';
    if (gender === 'female') return 'ring-pink-500/30';
    return 'ring-error/30';
  };

  const getStatusLabel = () => {
    if (isBooked) return 'Booked';
    if (isHeld) {
      if (isHeldByMe) return 'Your Hold';
      return 'Held';
    }
    if (isSelected) return 'Selected';
    if (hasGenderRestriction) {
      return restrictedGender === 'female' ? '♀ Female' : '♂ Male';
    }
    return 'Available';
  };

  const getStatusColor = () => {
    if (isBooked) return getGenderColorClass(bookedPassengerGender);
    if (isHeld) {
      if (isHeldByMe) return 'text-teal-400';
      return 'text-warning';
    }
    if (isSelected) return 'text-teal-400';
    if (hasGenderRestriction) {
      return restrictedGender === 'male' ? 'text-blue-400' : 'text-pink-400';
    }
    return 'text-success';
  };

  const getTooltipText = () => {
    if (isBooked) {
      if (bookedPassengerGender === 'male') return 'Male passenger';
      if (bookedPassengerGender === 'female') return 'Female passenger';
      return 'Booked';
    }
    if (isHeld) {
      if (isHeldByMe) return 'You are holding this seat — click Release to unhold';
      return 'Someone is booking this seat';
    }
    if (hasGenderRestriction && !isSelected) {
      const genderLabel = restrictedGender === 'female' ? '♀ Female' : '♂ Male';
      return `${genderLabel} passengers only`;
    }
    if (isWindow) return '🪟 Window seat';
    return '🚶 Aisle seat';
  };

  const handleRelease = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRelease) onRelease(seat.id);
  };

  return (
    <button
      onClick={isHeldByMe ? undefined : onClick}
      disabled={isDisabled}
      title={`Seat ${seat.seat_number} - ${getStatusLabel()}`}
      className={`
        relative group flex flex-col items-center
        transition-all duration-200 select-none
        ${
          isDisabled && !isHeldByMe
            ? 'cursor-not-allowed'
            : isHeldByMe
            ? 'cursor-default'
            : isSelected
            ? 'cursor-pointer'
            : 'cursor-pointer hover:scale-105'
        }
      `}
      style={{
        width: isSleeper ? '80px' : '76px',
        minHeight: isSleeper ? '70px' : '82px',
      }}
    >
      {/* Status label above seat */}
      <span className={`text-[10px] font-medium leading-none mb-0.5 ${getStatusColor()}`}>
        {getStatusLabel()}
      </span>

      {/* Seat graphic */}
      <div
        className={`
          w-full relative rounded-xl overflow-hidden
          transition-all duration-200
          ${
            isSelected
              ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-navy-900 shadow-lg shadow-teal-500/20'
              : isBooked
              ? `ring-1 ${getGenderBorderClass(bookedPassengerGender)}`
              : isHeld
              ? 'ring-1 ring-warning/30'
              : hasGenderRestriction
              ? restrictedGender === 'female'
                ? 'ring-1 ring-pink-500/30'
                : 'ring-1 ring-blue-500/30'
              : 'ring-1 ring-success/20 group-hover:ring-success/40'
          }
        `}
      >
        {isSleeper ? (
          <SleeperBedSvg
            isBooked={isBooked}
            isHeld={isHeld}
            isSelected={isSelected}
            seatLetter={seatLetter}
            isWindow={isWindow}
            passengerGender={bookedPassengerGender}
            restrictedGender={hasGenderRestriction ? restrictedGender : null}
          />
        ) : (
          <BusSeatSvg
            isBooked={isBooked}
            isHeld={isHeld}
            isSelected={isSelected}
            seatLetter={seatLetter}
            isWindow={isWindow}
            passengerGender={bookedPassengerGender}
            restrictedGender={hasGenderRestriction ? restrictedGender : null}
          />
        )}

        {/* Gender badge on booked seats (shows gender icon on the booked seat itself) */}
        {isBooked && bookedPassengerGender && (
          <div
            className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shadow-lg ${
              bookedPassengerGender === 'female'
                ? 'bg-pink-500 text-white'
                : 'bg-blue-500 text-white'
            }`}
          >
            {bookedPassengerGender === 'female' ? '♀' : '♂'}
          </div>
        )}

        {/* Gender badge overlay for restricted available seats */}
        {hasGenderRestriction && !isBooked && !isHeld && (
          <div
            className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shadow-lg ${
              restrictedGender === 'female'
                ? 'bg-pink-500 text-white'
                : 'bg-blue-500 text-white'
            }`}
            title={getTooltipText()}
          >
            {restrictedGender === 'female' ? '♀' : '♂'}
          </div>
        )}

        {/* Release button for seats held by current user */}
        {isHeldByMe && onRelease && (
          <div
            onClick={handleRelease}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <div className="px-2.5 py-1 rounded-lg bg-error text-white text-[10px] font-semibold flex items-center gap-1 shadow-lg hover:bg-error/90 transition-colors">
              <span>✕</span>
              Release
            </div>
          </div>
        )}
      </div>

      {/* Seat number below */}
      <span
        className={`
          text-[11px] font-semibold mt-0.5 leading-none
          ${isBooked ? `${getGenderColorClass(bookedPassengerGender)}/60` : isHeld ? (isHeldByMe ? 'text-teal-400/60' : 'text-warning/60') : isSelected ? 'text-teal-400' : hasGenderRestriction ? (restrictedGender === 'female' ? 'text-pink-400' : 'text-blue-400') : 'text-success/70'}
          ${isSelected ? 'font-bold' : ''}
        `}
      >
        {seat.seat_number}
      </span>

      {/* Hover tooltip - shows gender instead of names */}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-navy-900 border border-white/10 rounded text-[10px] text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg max-w-[240px]">
        {getTooltipText()}
      </div>
    </button>
  );
}

// ───────────────────────────────────────
// Seat Row Component
// ───────────────────────────────────────
function SeatRow({
  rowNumber,
  seatA,
  seatB,
  seatC,
  seatD,
  selectedSeats,
  onSeatClick,
  isSleeper,
  currentUserId,
  onReleaseSeat,
}: {
  rowNumber: number;
  seatA?: Seat;
  seatB?: Seat;
  seatC?: Seat;
  seatD?: Seat;
  selectedSeats: Seat[];
  onSeatClick: (seat: Seat) => void;
  isSleeper: boolean;
  currentUserId?: string;
  onReleaseSeat?: (seatId: string) => void;
}) {
  const renderSeat = (seat: Seat | undefined) => {
    if (!seat) return <div className={isSleeper ? 'w-[80px]' : 'w-[76px]'} />;
    const isSelected = selectedSeats.some((s) => s.id === seat.id);
    return (
      <BusSeatButton
        key={seat.id}
        seat={seat}
        isSelected={isSelected}
        onClick={() => onSeatClick(seat)}
        isSleeper={isSleeper}
        currentUserId={currentUserId}
        onRelease={onReleaseSeat}
      />
    );
  };

  return (
    <div className="flex items-center gap-0">
      {/* Row number */}
      <div className="w-6 text-[10px] text-text-secondary/50 font-medium text-right pr-2 shrink-0">
        {rowNumber}
      </div>

      {/* Left column pair */}
      <div className="flex items-center gap-2" style={{ minWidth: '168px' }}>
        {renderSeat(seatA)}
        {renderSeat(seatB)}
      </div>

      {/* Aisle */}
      <div className="flex items-center justify-center px-3 shrink-0">
        <div className="w-1 h-10 bg-white/5 rounded-full" />
      </div>

      {/* Right column pair */}
      <div className="flex items-center gap-2" style={{ minWidth: '168px' }}>
        {renderSeat(seatC)}
        {renderSeat(seatD)}
      </div>

      {/* Window edge marker */}
      <div className="w-3 flex justify-center shrink-0">
        <div className="w-0.5 h-10 bg-teal-500/15 rounded-full" />
      </div>
    </div>
  );
}

// ───────────────────────────────────────
// Main SeatSelection Page
// ───────────────────────────────────────
export default function SeatSelection() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const routeInfo = (location.state as any)?.route as RouteInfo | undefined;

  const { isAuthenticated, user } = useAuthStore();
  const { seats, loading, refetch: refetchSeats } = useSeats(routeId);
  const currentUserId = user?.id;
  const {
    selectedSeats,
    holdExpiry,
    addSelectedSeat,
    removeSelectedSeat,
    setSelectedSeats,
    setHoldExpiry,
    setCurrentRoute,
    currentRoute,
  } = useBookingStore();

  const [route, setRoute] = useState<RouteInfo | null>(routeInfo || null);
  const [activeDeck, setActiveDeck] = useState<'lower' | 'upper'>('lower');
  const [holdingSeats, setHoldingSeats] = useState(false);
  const [bookingWindowEnd, setBookingWindowEnd] = useState<number | null>(null);
  const [bookingWindowOpen, setBookingWindowOpen] = useState(true);
  const [showBookingClosedModal, setShowBookingClosedModal] = useState(false);

  useEffect(() => {
    if (routeInfo) {
      setRoute(routeInfo);
      setCurrentRoute(routeInfo);
    }
  }, [routeInfo, setCurrentRoute]);

  // Fetch booking window info from the seats endpoint (which now returns route data)
  useEffect(() => {
    if (!routeId) return;
    const fetchRouteInfo = async () => {
      try {
        const res = await api.get(`/api/seats/${routeId}`);
        if (res.data.route) {
          const r = res.data.route;
          if (!routeInfo) {
            // Also set route if not already set from location state
            setRoute({
              id: r.id,
              departure_time: r.departure_time,
              arrival_time: r.arrival_time,
              duration_minutes: r.duration_minutes,
              fare: r.fare,
              travel_date: r.travel_date,
              origin_city: r.origin_city,
              destination_city: r.destination_city,
              bus_name: r.bus_name,
              bus_type: r.bus_type,
              bus_number: r.bus_number,
            });
          }
          // Calculate booking window end time
          const [hours, mins] = r.departure_time.split(':').map(Number);
          const dep = new Date(r.travel_date);
          dep.setHours(hours, mins, 0, 0);
          const cutoffMs = r.booking_cutoff_minutes * 60 * 1000;
          setBookingWindowEnd(dep.getTime() - cutoffMs);
          setBookingWindowOpen(Date.now() < dep.getTime() - cutoffMs);
        }
      } catch (e) {
        // Ignore
      }
    };
    fetchRouteInfo();
  }, [routeId]);

  // Check booking window every 30 seconds
  useEffect(() => {
    if (!bookingWindowEnd) return;
    const interval = setInterval(() => {
      if (Date.now() >= bookingWindowEnd) {
        setBookingWindowOpen(false);
        setShowBookingClosedModal(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [bookingWindowEnd]);

  // Also check on every render via a second interval for real-time
  useEffect(() => {
    if (!bookingWindowEnd) return;
    const interval = setInterval(() => {
      if (Date.now() >= bookingWindowEnd) {
        setBookingWindowOpen(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [bookingWindowEnd]);

  // Countdown timer for seat hold
  const handleHoldExpiry = () => {
    toast.error('Your seat hold has expired. Please select seats again.');
    setSelectedSeats([]);
    setHoldExpiry(null);
  };

  const { timeString, totalSecondsRemaining, minutesRemaining } = useCountdown(
    holdExpiry,
    handleHoldExpiry
  );

  // Warn at 2 minutes remaining
  useEffect(() => {
    if (minutesRemaining <= 2 && minutesRemaining > 0 && holdExpiry) {
      toast('Only 2 minutes left to complete booking!', {
        icon: '⚠️',
        style: { background: '#F59E0B', color: '#000' },
      });
    }
  }, [minutesRemaining, holdExpiry]);

  const handleSeatClick = async (seat: Seat) => {
    if (!isAuthenticated()) {
      toast.error('Please login to book seats');
      navigate('/login');
      return;
    }

    if (seat.status === 'booked') return;
    if (seat.status === 'held' && seat.held_by_name) {
      toast('Someone is booking this seat', { icon: '⏳' });
      return;
    }

    const isSelected = selectedSeats.some((s) => s.id === seat.id);
    if (isSelected) {
      removeSelectedSeat(seat.id);
      return;
    }

    addSelectedSeat(seat);
  };

  const handleHoldSeats = async () => {
    if (!isAuthenticated()) {
      toast.error('Please login to book seats');
      navigate('/login');
      return;
    }

    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat');
      return;
    }

    setHoldingSeats(true);
    try {
      const response = await api.post('/api/seats/hold', {
        seatIds: selectedSeats.map((s) => s.id),
        routeId,
      });

      setHoldExpiry(response.data.heldUntil);
      toast.success(`${selectedSeats.length} seats held for 10 minutes!`);
    } catch (error: any) {
      if (error.response?.data?.type === 'ConflictError') {
        toast.error('Some seats are no longer available. Please reselect.');
        setSelectedSeats([]);
      } else {
        toast.error('Failed to hold seats. Please try again.');
      }
    } finally {
      setHoldingSeats(false);
    }
  };

  const handleProceedToCheckout = () => {
    if (!route) {
      toast.error('Route information not available');
      return;
    }
    navigate('/checkout', { state: { route } });
  };

  const handleReleaseSeat = async (seatId: string) => {
    try {
      await api.post('/api/seats/release', { seatIds: [seatId] });
      toast.success('Seat released successfully');

      // Clear all selected seats and hold expiry so the user MUST re-select
      // and re-hold before checkout. This prevents a tricky bug where a
      // newly selected (but un-held) seat could be taken to checkout.
      // Also, after releasing one seat, the remaining held-by-you seats in
      // selectedSeats would fail a re-hold since they're still 'held' in DB.
      setSelectedSeats([]);
      setHoldExpiry(null);

      // Refresh seat data immediately so the released seat shows as available
      refetchSeats();
    } catch (error: any) {
      toast.error('Failed to release seat. Please try again.');
    }
  };

  // Filter seats by active deck
  const filteredSeats = useMemo(() => {
    return seats.filter((s) => s.deck === activeDeck);
  }, [seats, activeDeck]);

  // Group seats by row and column
  const groupedSeats = useMemo(() => {
    const rows: { [key: number]: Seat[] } = {};
    filteredSeats.forEach((seat) => {
      const match = seat.seat_number.match(/^(\d+)/);
      const rowNum = match ? parseInt(match[1]) : 0;
      if (!rows[rowNum]) rows[rowNum] = [];
      rows[rowNum].push(seat);
    });
    return Object.entries(rows)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([row, rowSeats]) => ({
        row: parseInt(row),
        seats: rowSeats.sort((a, b) => a.seat_number.localeCompare(b.seat_number)),
      }));
  }, [filteredSeats]);

  const totalFare = selectedSeats.length * (route?.fare || 0);

  const formatTime = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  // Compute booking window countdown in dd-hh-mm-ss format
  const getBookingWindowTimeString = () => {
    if (!bookingWindowEnd || !bookingWindowOpen) return '';
    const diff = bookingWindowEnd - Date.now();
    if (diff <= 0) return '';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${String(days).padStart(2, '0')}-${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const [bwTime, setBwTime] = useState('');
  useEffect(() => {
    if (!bookingWindowEnd) return;
    const interval = setInterval(() => {
      setBwTime(getBookingWindowTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, [bookingWindowEnd, bookingWindowOpen]);

  const isBookingWindowUrgent = bookingWindowEnd && bookingWindowOpen && (bookingWindowEnd - Date.now()) < 30 * 60 * 1000;

  // Check if all seats are booked (sold out)
  const totalSeats = seats.length;
  const bookedSeats = seats.filter((s) => s.status === 'booked').length;
  const heldSeats = seats.filter((s) => s.status === 'held' && !!s.held_by_name).length;
  const availableSeats = seats.filter((s) => s.status === 'available').length;
  const isSoldOut = totalSeats > 0 && availableSeats === 0;

  // Check if bus is sleeper type
  const isSleeper = route?.bus_type === 'Sleeper';

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner !w-10 !h-10" />
          <p className="text-text-secondary text-sm">Loading seats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ⏰ Booking Window Countdown Banner */}
        {bookingWindowEnd && bookingWindowOpen && (
          <div className={`mb-4 p-3 rounded-xl flex items-center justify-center gap-3 ${
            isBookingWindowUrgent
              ? 'bg-warning/15 border border-warning/30'
              : 'bg-teal-500/10 border border-teal-500/30'
          }`}>
            <Clock className={`w-4 h-4 ${isBookingWindowUrgent ? 'text-warning' : 'text-teal-400'}`} />
            <span className={`text-sm font-medium ${isBookingWindowUrgent ? 'text-warning' : 'text-teal-400'}`}>
              Booking window closes in: <span className="font-mono font-bold">{bwTime || '--:--:--:--'}</span>
            </span>
            {isBookingWindowUrgent && (
              <span className="text-xs text-warning/80">⚠️ Hurry!</span>
            )}
          </div>
        )}

        {/* Booking Closed Modal */}
        {showBookingClosedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative bg-navy-900 rounded-2xl border border-white/10 max-w-md w-full p-8 text-center animate-slide-up">
              <div className="w-16 h-16 rounded-full bg-error/10 border border-error/30 mx-auto flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-error" />
              </div>
              <h2 className="text-xl font-bold mb-2">Booking Window Closed</h2>
              <p className="text-sm text-text-secondary mb-6">
                Sorry, the booking window for this trip has now closed. You cannot complete this booking.
              </p>
              <button
                onClick={() => navigate('/')}
                className="btn-primary"
              >
                Back to Search
              </button>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Select Your Seats</h1>
            {route && (
              <p className="text-text-secondary text-sm flex items-center gap-2 mt-0.5">
                <Bus className="w-4 h-4 shrink-0" />
                {route.bus_name}
                <span className="text-text-secondary/50">·</span>
                {route.origin_city} → {route.destination_city}
                <span className="text-text-secondary/50">·</span>
                <Clock className="w-3.5 h-3.5" />
                {formatTime(route.departure_time)}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          {/* ════════════════════════════════════════ */}
          {/* Seat Map Area */}
          {/* ════════════════════════════════════════ */}
          <div className="min-w-0">
            <div className="card p-5">
              {/* Legend */}
              <div className="flex items-center gap-5 mb-5 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-success/25 border border-success/60" />
                  <span className="text-xs text-text-secondary">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-teal-500/25 border border-teal-400" />
                  <span className="text-xs text-text-secondary">Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-warning/25 border border-warning/60" />
                  <span className="text-xs text-text-secondary">Held</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/60" />
                  <span className="text-xs text-text-secondary">Booked (Male)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-pink-500/20 border border-pink-500/60" />
                  <span className="text-xs text-text-secondary">Booked (Female)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[9px] text-white font-bold">♂</div>
                  <span className="text-xs text-text-secondary">Male passengers only</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-pink-500 flex items-center justify-center text-[9px] text-white font-bold">♀</div>
                  <span className="text-xs text-text-secondary">Female passengers only</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-white/10 border border-white/30" />
                  <span className="text-xs text-text-secondary flex items-center gap-1">
                    <span className="text-[10px]">🪟</span> Window
                  </span>
                </div>
              </div>

              {/* Deck Tabs (for Sleeper buses) */}
              {isSleeper && (
                <div className="flex gap-2 mb-5">
                  <button
                    onClick={() => setActiveDeck('lower')}
                    className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeDeck === 'lower'
                        ? 'bg-teal-500/20 text-teal-400 border border-teal-500/50 shadow-sm shadow-teal-500/10'
                        : 'bg-navy-900 text-text-secondary border border-white/10 hover:border-white/30'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4 inline mr-1.5" />
                    Lower Deck
                  </button>
                  <button
                    onClick={() => setActiveDeck('upper')}
                    className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeDeck === 'upper'
                        ? 'bg-teal-500/20 text-teal-400 border border-teal-500/50 shadow-sm shadow-teal-500/10'
                        : 'bg-navy-900 text-text-secondary border border-white/10 hover:border-white/30'
                    }`}
                  >
                    <ChevronUp className="w-4 h-4 inline mr-1.5" />
                    Upper Deck
                  </button>
                </div>
              )}

              {/* Sold Out Banner */}
              {isSoldOut && (
                <div className="mb-4 p-5 rounded-xl bg-error/10 border border-error/30 text-center">
                  <p className="text-lg font-bold text-error mb-1">Sold Out</p>
                  <p className="text-sm text-error/80">All {totalSeats} seats are booked for this trip.</p>
                  <p className="text-xs text-text-secondary mt-2">Cancelled bookings may release seats. Check back later.</p>
                </div>
              )}

              {/* Booking Window Closed Banner (when not already showing the modal) */}
              {!bookingWindowOpen && !showBookingClosedModal && (
                <div className="mb-4 p-5 rounded-xl bg-warning/10 border border-warning/30 text-center">
                  <p className="text-lg font-bold text-warning mb-1">Booking Window Closed</p>
                  <p className="text-sm text-warning/80">The booking window for this trip has closed.</p>
                </div>
              )}

              {/* ── Seat Grid - Luxury Bus Layout ── */}
              <div className="flex justify-center overflow-x-auto pb-2">
                <div className="inline-block animate-fade-in">
                  {/* Bus Body */}
                  <div className="bg-navy-900/40 rounded-2xl border border-white/10 p-5 relative min-w-[480px]">
                    {/* ── Bus Front Section ── */}
                    <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/5">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy/40">
                        <ShipWheel className="w-4 h-4 text-text-secondary" />
                        <span className="text-xs text-text-secondary font-medium">Driver</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy/40">
                        <DoorOpen className="w-4 h-4 text-text-secondary" />
                        <span className="text-xs text-text-secondary font-medium">Entry</span>
                      </div>
                    </div>

                    {/* ── Column Headers ── */}
                    <div className="flex items-center mb-4 gap-0">
                      <div className="w-6 shrink-0" />
                      <div className="flex items-center" style={{ minWidth: '168px' }}>
                        <div className="text-center text-[9px] text-text-secondary/50 font-semibold uppercase tracking-wider w-[76px]">
                          A
                          <span className="block text-[7px] opacity-40">Window</span>
                        </div>
                        <div className="text-center text-[9px] text-text-secondary/50 font-semibold uppercase tracking-wider w-[76px]">
                          B
                          <span className="block text-[7px] opacity-40">Aisle</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center px-3 shrink-0">
                        <span className="text-[8px] text-text-secondary/30 uppercase tracking-widest font-medium">
                          Aisle
                        </span>
                      </div>
                      <div className="flex items-center" style={{ minWidth: '168px' }}>
                        <div className="text-center text-[9px] text-text-secondary/50 font-semibold uppercase tracking-wider w-[76px]">
                          C
                          <span className="block text-[7px] opacity-40">Aisle</span>
                        </div>
                        <div className="text-center text-[9px] text-text-secondary/50 font-semibold uppercase tracking-wider w-[76px]">
                          D
                          <span className="block text-[7px] opacity-40">Window</span>
                        </div>
                      </div>
                      <div className="w-3 shrink-0" />
                    </div>

                    {/* ── Seat Rows ── */}
                    <div className="space-y-2.5">
                      {groupedSeats.map(({ row, seats: rowSeats }) =>    {
      const seatA = rowSeats.find((s) => s.seat_number.endsWith('A'));
      const seatB = rowSeats.find((s) => s.seat_number.endsWith('B'));
      const seatC = rowSeats.find((s) => s.seat_number.endsWith('C'));
      const seatD = rowSeats.find((s) => s.seat_number.endsWith('D'));

      return (
        <SeatRow
          key={row}
          rowNumber={row}
          seatA={seatA}
          seatB={seatB}
          seatC={seatC}
          seatD={seatD}
          selectedSeats={selectedSeats}
          onSeatClick={handleSeatClick}
          isSleeper={isSleeper}
          currentUserId={currentUserId}
          onReleaseSeat={handleReleaseSeat}
        />
                        );
                      })}
                    </div>

                    {/* ── Rear of Bus ── */}
                    <div className="mt-5 pt-4 border-t border-white/5 flex justify-center">
                      <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-navy/40">
                        <span className="text-[10px] text-text-secondary/40">Rear of Bus</span>
                        <span className="text-xs">🛑</span>
                      </div>
                    </div>

                    {/* Empty state */}
                    {groupedSeats.length === 0 && (
                      <div className="text-center py-16 text-text-secondary">
                        <Bus className="w-14 h-14 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">No seats available for this deck</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {!isAuthenticated() && (
                <div className="mt-5 p-4 bg-warning/10 border border-warning/20 rounded-lg text-center">
                  <p className="text-sm text-warning font-medium">
                    🔒 Please login to select and book seats
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ════════════════════════════════════════ */}
          {/* Right Panel - Booking Summary */}
          {/* ════════════════════════════════════════ */}
          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-24 space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                <div className="w-9 h-9 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
                  <Armchair className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Booking Summary</h3>
                  <p className="text-[11px] text-text-secondary">Review your selection</p>
                </div>
              </div>

              {/* Selected Seats */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs text-text-secondary font-medium flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Selected Seats
                  </p>
                  {selectedSeats.length > 0 && (
                    <span className="text-xs font-semibold text-teal-400">{selectedSeats.length}</span>
                  )}
                </div>

                {selectedSeats.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSeats.map((seat) => (
                      <span
                        key={seat.id}
                        className="group relative px-2.5 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-xs text-teal-400 flex items-center gap-1 font-medium transition-all hover:bg-teal-500/20"
                      >
                        <Armchair className="w-3 h-3" />
                        {seat.seat_number}
                        <button
                          onClick={() => removeSelectedSeat(seat.id)}
                          className="ml-0.5 hover:text-white transition-colors"
                        >
                          <span className="block w-3.5 h-3.5 rounded-full bg-teal-500/20 hover:bg-teal-500/40 flex items-center justify-center text-[10px] leading-none transition-colors">
                            ×
                          </span>
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-navy-800 border border-white/5 flex items-center justify-center">
                      <Armchair className="w-6 h-6 text-text-secondary/40" />
                    </div>
                    <p className="text-xs text-text-secondary">
                      Click on available seats to select
                    </p>
                  </div>
                )}
              </div>

              {/* Route Info */}
              {route && (
                <div className="p-3 rounded-xl bg-navy/50 border border-white/5 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Route</span>
                    <span className="font-medium text-white/90">
                      {route.origin_city} → {route.destination_city}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Bus</span>
                    <span className="font-medium text-white/90">{route.bus_name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Departure</span>
                    <span className="font-medium text-white/90">{formatTime(route.departure_time)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Duration</span>
                    <span className="font-medium text-white/90">{route.duration_minutes} min</span>
                  </div>
                </div>
              )}

              {/* Fare Breakdown */}
              <div className="space-y-2.5 p-3 rounded-xl bg-navy/50 border border-white/5">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Fare per seat</span>
                  <span className="font-medium">₹{route?.fare || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Seats</span>
                  <span className="font-medium">× {selectedSeats.length}</span>
                </div>
                <div className="border-t border-white/10 pt-2.5 flex justify-between items-end">
                  <span className="text-sm text-text-secondary">Total</span>
                  <span className="text-xl font-bold text-teal-400">
                    ₹{totalFare.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Countdown Timer */}
              {holdExpiry && (
                <div
                  className={`text-center p-4 rounded-xl ${
                    minutesRemaining <= 2
                      ? 'bg-warning/10 border border-warning/30'
                      : 'bg-teal-500/10 border border-teal-500/30'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Timer className={`w-4 h-4 ${minutesRemaining <= 2 ? 'text-warning' : 'text-teal-400'}`} />
                    <p className={`text-xs font-medium ${minutesRemaining <= 2 ? 'text-warning' : 'text-teal-400'}`}>
                      Hold Expires In
                    </p>
                  </div>
                  <p
                    className={`text-3xl font-bold font-mono tracking-wider ${
                      minutesRemaining <= 2 ? 'text-warning' : 'text-teal-400'
                    }`}
                  >
                    {timeString}
                  </p>
                  {minutesRemaining <= 2 && (
                    <p className="text-xs text-warning mt-1.5 font-medium flex items-center justify-center gap-1">
                      <span>⚠️</span>
                      Hurry! Almost expired
                    </p>
                  )}
                  {/* Progress bar */}
                  <div className="mt-3 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        minutesRemaining <= 2 ? 'bg-warning' : 'bg-teal-400'
                      }`}
                      style={{
                        width: `${Math.max(0, (totalSecondsRemaining / 600) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2.5">
                {!holdExpiry ? (
                  <button
                    onClick={handleHoldSeats}
                    disabled={selectedSeats.length === 0 || holdingSeats}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {holdingSeats ? (
                      <>
                        <span className="spinner !w-4 !h-4" />
                        Holding seats...
                      </>
                    ) : (
                      <>
                        <Armchair className="w-4 h-4" />
                        {selectedSeats.length > 0
                          ? `Hold ${selectedSeats.length} Seat${selectedSeats.length > 1 ? 's' : ''}`
                          : 'Select Seats First'}
                      </>
                    )}
                  </button>
                ) : (
                  <button onClick={handleProceedToCheckout} className="btn-primary w-full flex items-center justify-center gap-2">
                    Proceed to Passenger Details
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
                )}

                <p className="text-[11px] text-text-secondary text-center flex items-center justify-center gap-1">
                  <Info className="w-3 h-3" />
                  Seats held for 10 minutes. Complete booking before expiry.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
