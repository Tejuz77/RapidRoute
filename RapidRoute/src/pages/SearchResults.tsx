import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Bus,
  Clock,
  IndianRupee,
  ArrowRight,
  Filter,
  X,
  Star,
  BatteryCharging,
  Wifi,
  Wind,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

interface Route {
  id: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  fare: number;
  travel_date: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  bus_id: string;
  bus_name: string;
  bus_number: string;
  bus_type: string;
  amenities: string[];
  total_seats: number;
  available_seats: number;
  bookingOpen?: boolean;
  bookingClosesAt?: string;
  timeUntilClose?: string;
  bus_status?: string;
  cancelled_from?: string;
  cancelled_until?: string;
}

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const dateParam = searchParams.get('date');

  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'price' | 'duration' | 'departure'>('departure');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [busTypes, setBusTypes] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchRoutes();
  }, [fromParam, toParam, dateParam]);

  const fetchRoutes = async () => {
    if (!fromParam || !toParam || !dateParam) return;

    setLoading(true);
    try {
      const response = await api.get('/api/search', {
        params: { from: fromParam, to: toParam, date: dateParam },
      });
      setRoutes(response.data.routes);
    } catch (error: any) {
      toast.error('Failed to fetch routes');
    } finally {
      setLoading(false);
    }
  };

  const filteredRoutes = routes
    .filter((r) => r.fare >= priceRange[0] && r.fare <= priceRange[1])
    .filter((r) => busTypes.length === 0 || busTypes.includes(r.bus_type))
    .filter((r) => {
      if (timeSlots.length === 0) return true;
      const hour = parseInt(r.departure_time.split(':')[0]);
      return timeSlots.some((slot) => {
        if (slot === 'Morning') return hour >= 6 && hour < 12;
        if (slot === 'Afternoon') return hour >= 12 && hour < 17;
        if (slot === 'Evening') return hour >= 17 && hour < 21;
        if (slot === 'Night') return hour >= 21 || hour < 6;
        return false;
      });
    })
    .sort((a, b) => {
      if (sortBy === 'price') return a.fare - b.fare;
      if (sortBy === 'duration') return a.duration_minutes - b.duration_minutes;
      return a.departure_time.localeCompare(b.departure_time);
    });

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const formatDuration = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const getBusTypeIcon = (type: string) => {
    switch (type) {
      case 'Sleeper':
        return '🛏️';
      case 'Semi-Sleeper':
        return '💺';
      case 'Seater':
        return '🪑';
      default:
        return '🚌';
    }
  };

  const toggleBusType = (type: string) => {
    setBusTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleTimeSlot = (slot: string) => {
    setTimeSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="spinner !w-10 !h-10" />
      </div>
    );
  }

  const TIME_SLOTS = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const BUS_TYPES = ['Sleeper', 'Semi-Sleeper', 'Seater'];

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Available Buses</h1>
            <p className="text-text-secondary mt-1">
              {routes.length > 0
                ? `${filteredRoutes.length} buses found`
                : 'No buses found for this route'}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center gap-2 text-sm lg:hidden"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Filters (Desktop) */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="card p-5 sticky top-24 space-y-6">
              <h3 className="font-semibold">Filters</h3>

              {/* Price Range */}
              <div>
                <label className="text-sm text-text-secondary mb-2 block">
                  Price Range: ₹{priceRange[0]} - ₹{priceRange[1]}
                </label>
                <input
                  type="range"
                  min={0}
                  max={5000}
                  step={100}
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full accent-teal-500"
                />
              </div>

              {/* Bus Type */}
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Bus Type</label>
                <div className="space-y-2">
                  {BUS_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={busTypes.includes(type)}
                        onChange={() => toggleBusType(type)}
                        className="rounded border-white/20 accent-teal-500"
                      />
                      <span className="text-sm">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Departure Time</label>
                <div className="space-y-2">
                  {TIME_SLOTS.map((slot) => (
                    <label key={slot} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={timeSlots.includes(slot)}
                        onChange={() => toggleTimeSlot(slot)}
                        className="rounded border-white/20 accent-teal-500"
                      />
                      <span className="text-sm">{slot}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="select-field text-sm"
                >
                  <option value="departure">Departure Time</option>
                  <option value="price">Price</option>
                  <option value="duration">Duration</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1">
            {filteredRoutes.length === 0 ? (
              <div className="card p-12 text-center">
                <Bus className="w-16 h-16 text-text-secondary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No buses found</h3>
                <p className="text-text-secondary">
                  Try different dates or routes
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRoutes.map((route) => (
                  <div key={route.id} className="card p-6 animate-slide-up">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                      {/* Bus Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">{getBusTypeIcon(route.bus_type)}</span>
                          <div>
                            <h3 className="font-semibold">{route.bus_name}</h3>
                            <p className="text-xs text-text-secondary">
                              {route.bus_number} · {route.bus_type}
                            </p>
                          </div>
                        </div>

                        {/* Route timing */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <p className="text-lg font-bold">{formatTime(route.departure_time)}</p>
                            <p className="text-xs text-text-secondary">{route.origin_city}</p>
                          </div>

                          <div className="flex-1 flex flex-col items-center px-4">
                            <span className="text-xs text-text-secondary mb-1">
                              {formatDuration(route.duration_minutes)}
                            </span>
                            <div className="w-full h-px bg-gradient-to-r from-teal-500/20 via-teal-500 to-teal-500/20 relative">
                              <ArrowRight className="w-4 h-4 text-teal-400 absolute right-0 top-1/2 -translate-y-1/2" />
                            </div>
                            <span className="text-xs text-text-secondary mt-1">
                              {route.bus_type}
                            </span>
                          </div>

                          <div className="text-center">
                            <p className="text-lg font-bold">{formatTime(route.arrival_time)}</p>
                            <p className="text-xs text-text-secondary">{route.destination_city}</p>
                          </div>
                        </div>

                        {/* Bus Status & Booking Window Badge */}
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          {route.bus_status && route.bus_status !== 'active' && (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-error/10 text-error border border-error/20">
                              <AlertTriangle className="w-3 h-3" />
                              Temporarily Unavailable
                            </span>
                          )}
                          {(!route.bus_status || route.bus_status === 'active') && (
                            route.bookingOpen === false ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-error/10 text-error border border-error/20">
                                ✗ Booking closed
                              </span>
                            ) : route.timeUntilClose && route.timeUntilClose.includes('2 hr') || route.timeUntilClose?.includes('1 hr') || (route.timeUntilClose?.includes('min') && !route.timeUntilClose?.includes('hr')) ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-warning/10 text-warning border border-warning/20">
                                ⏰ {route.timeUntilClose}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20">
                                ✓ Booking open
                              </span>
                            )
                          )}
                        </div>

                        {/* Amenities */}
                        <div className="flex items-center gap-3 mt-3">
                          {route.amenities?.slice(0, 4).map((amenity) => (
                            <span
                              key={amenity}
                              className="text-xs bg-white/5 px-2 py-1 rounded-full text-text-secondary"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>                        {/* Fare & Action */}
                      <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-4 lg:min-w-[180px] lg:border-l border-white/10 lg:pl-6">
                        <div className="text-center lg:text-right">
                          <p className="text-2xl font-bold text-teal-400">
                            ₹{route.fare}
                          </p>
                          <p className="text-xs text-text-secondary">per seat</p>
                        </div>
                        <div className="text-center lg:text-right">
                          {route.available_seats > 0 ? (
                            <>
                              <p className="text-sm font-medium">{route.available_seats}</p>
                              <p className="text-xs text-text-secondary">seats left</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-bold text-error">Sold Out</p>
                              <p className="text-xs text-error/70">All seats booked</p>
                            </>
                          )}
                        </div>
                        <div className="relative group">
                          {route.bus_status === 'temporarily_cancelled' ? (
                            <>
                              <button
                                disabled
                                className="btn-primary text-sm px-6 py-2 opacity-50 cursor-not-allowed"
                              >
                                Unavailable
                              </button>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-navy-900 border border-white/10 rounded-lg text-[11px] text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                This bus is temporarily unavailable. Please check back later.
                              </div>
                            </>
                          ) : route.available_seats === 0 ? (
                            <>
                              <button
                                disabled
                                className="btn-primary text-sm px-6 py-2 opacity-50 cursor-not-allowed"
                              >
                                Sold Out
                              </button>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-navy-900 border border-white/10 rounded-lg text-[11px] text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                All seats are booked for this trip.
                              </div>
                            </>
                          ) : route.bookingOpen === false ? (
                            <>
                              <button
                                disabled
                                className="btn-primary text-sm px-6 py-2 opacity-50 cursor-not-allowed"
                              >
                                Booking Closed
                              </button>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-navy-900 border border-white/10 rounded-lg text-[11px] text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                Booking window has closed for this trip.
                              </div>
                            </>
                          ) : (
                            <button
                              onClick={() => navigate(`/seats/${route.id}`, { state: { route } })}
                              className="btn-primary text-sm px-6 py-2"
                            >
                              Select Seats
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Filters Modal */}
        {showFilters && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowFilters(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-navy-900 rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg">Filters</h3>
                <button onClick={() => setShowFilters(false)}>
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <label className="text-sm text-text-secondary mb-2 block">
                  Price Range: ₹{priceRange[0]} - ₹{priceRange[1]}
                </label>
                <input
                  type="range"
                  min={0}
                  max={5000}
                  step={100}
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full accent-teal-500"
                />
              </div>

              {/* Bus Type */}
              <div className="mb-6">
                <label className="text-sm text-text-secondary mb-2 block">Bus Type</label>
                <div className="flex flex-wrap gap-2">
                  {BUS_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleBusType(type)}
                      className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                        busTypes.includes(type)
                          ? 'border-teal-500 bg-teal-500/20 text-teal-400'
                          : 'border-white/10 text-text-secondary'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              <div className="mb-6">
                <label className="text-sm text-text-secondary mb-2 block">Departure Time</label>
                <div className="flex flex-wrap gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => toggleTimeSlot(slot)}
                      className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                        timeSlots.includes(slot)
                          ? 'border-teal-500 bg-teal-500/20 text-teal-400'
                          : 'border-white/10 text-text-secondary'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowFilters(false)}
                className="btn-primary w-full"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
