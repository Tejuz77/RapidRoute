import React, { useState, useEffect } from 'react';
import {
  Bus,
  Plus,
  Route,
  Calendar,
  Clock,
  IndianRupee,
  Trash2,
  Eye,
  Users,
  AlertTriangle,
  RefreshCw,
  MapPin,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Gauge,
  PauseCircle,
  PlayCircle,
  XCircle,
  CreditCard,
  CheckCircle,
  Loader,
  Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

interface City {
  id: number;
  name: string;
  state: string;
}

interface BusData {
  id: string;
  name: string;
  bus_number: string;
  type: string;
  total_seats: number;
  amenities: string[];
  total_routes: number;
  upcoming_routes: number;
  booked_seats: number;
  held_seats: number;
  occupancy_percentage: number;
  created_at: string;
  status?: string;
  cancelled_from?: string;
  cancelled_until?: string;
}

interface RouteData {
  id: string;
  origin_city: string;
  destination_city: string;
  bus_name: string;
  bus_number: string;
  bus_type: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  fare: number;
  travel_date: string;
  total_seats: number;
  available_seats: number;
  booked_seats: number;
  bus_id: string;
}

interface BookingData {
  id: string;
  user_name: string;
  user_email: string;
  origin_city: string;
  destination_city: string;
  bus_name: string;
  bus_number: string;
  seat_ids: string[];
  passenger_names: string[];
  total_fare: number;
  status: string;
  created_at: string;
  travel_date: string;
  departure_time: string;
}

const SubscriptionBadge = ({ busId, onRenew }: { busId: string; onRenew: () => void }) => {
  const [subData, setSubData] = useState<{ isExpired: boolean; endDate: string; status: string } | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchSub = async () => {
    try {
      const res = await api.get(`/api/operator/buses/${busId}/subscription`);
      if (res.data.subscription) {
        setSubData({
          isExpired: res.data.subscription.isExpired,
          endDate: res.data.subscription.end_date,
          status: res.data.subscription.status,
        });
      }
    } catch {}
  };

  useEffect(() => {
    fetchSub();
  }, [busId]);

  if (!subData) return null;

  // Cancelled subscription
  if (subData.status === 'cancelled') {
    return (
      <span className="text-xs text-error flex items-center gap-1">
        <Ban className="w-3 h-3" /> Subscription Cancelled
      </span>
    );
  }

  // Expired subscription — show resubscribe / cancel options
  if (subData.isExpired || subData.status === 'expired') {
    return (
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={async (e) => {
            e.stopPropagation();
            setRenewing(true);
            try {
              await api.post(`/api/operator/buses/${busId}/renew-subscription`);
              toast.success('Subscription renewed! New period started.', { duration: 4000 });
              onRenew();
              fetchSub();
            } catch (err: any) {
              toast.error(err.response?.data?.error || 'Failed to renew');
            } finally {
              setRenewing(false);
            }
          }}
          disabled={renewing}
          className="text-xs px-2 py-1 rounded-lg bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 transition-colors"
        >
          {renewing ? 'Processing...' : '🔄 Resubscribe (₹4,000)'}
        </button>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            if (!confirm('Cancel subscription permanently? The bus will remain but without subscription benefits.')) return;
            setCancelling(true);
            try {
              await api.post(`/api/operator/buses/${busId}/cancel-subscription`);
              toast.success('Subscription cancelled');
              onRenew();
              fetchSub();
            } catch (err: any) {
              toast.error(err.response?.data?.error || 'Failed to cancel');
            } finally {
              setCancelling(false);
            }
          }}
          disabled={cancelling}
          className="text-xs px-2 py-1 rounded-lg bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors"
        >
          {cancelling ? 'Processing...' : '✕ Cancel Subscription'}
        </button>
      </div>
    );
  }

  // Active subscription
  const daysLeft = Math.ceil((new Date(subData.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 30) {
    return (
      <span className="text-xs text-warning">Sub expires in {daysLeft}d</span>
    );
  }
  return (
    <span className="text-xs text-success">Sub active — {daysLeft}d remaining</span>
  );
};

export default function OperatorDashboard() {
  const { user, isOperator, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'buses' | 'routes' | 'bookings' | 'add-bus' | 'add-route'>('buses');
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState<BusData[]>([]);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [expandedBus, setExpandedBus] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalRevenue: number; totalBuses: number; totalRoutes: number; totalBookings: number } | null>(null);

  // New bus form
  const [busForm, setBusForm] = useState({
    name: '',
    bus_number: '',
    type: 'Seater',
    total_seats: 40,
    amenities: '',
  });

  // New route form
  const [routeForm, setRouteForm] = useState({
    bus_id: '',
    origin_city_id: '',
    destination_city_id: '',
    departure_time: '08:00',
    arrival_time: '12:00',
    duration_minutes: 240,
    fare: '500',
    travel_date: new Date().toISOString().split('T')[0],
  });
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<{ busId: string; busName: string } | null>(null);
  const [cancelDateFrom, setCancelDateFrom] = useState('');
  const [cancelDateUntil, setCancelDateUntil] = useState('');
  const [cancelAllUpcoming, setCancelAllUpcoming] = useState(false);

  // Payment dialog for bus registration
  const [paymentDialog, setPaymentDialog] = useState<{
    formData: typeof busForm;
    amenities: string[];
    show: boolean;
    processing: boolean;
    success: boolean | null;
  }>({ formData: busForm, amenities: [], show: false, processing: false, success: null });
  const SUBSCRIPTION_PRICE = 4000;
  const SUBSCRIPTION_DAYS = 180;

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!isOperator()) {
      toast.error('Operator access required');
      navigate('/');
      return;
    }
    fetchData();
    fetchCities();
  }, [isAuthenticated, isOperator]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [busesRes, routesRes, bookingsRes, statsRes] = await Promise.all([
        api.get('/api/operator/buses'),
        api.get('/api/operator/routes'),
        api.get('/api/operator/bookings'),
        api.get('/api/operator/stats'),
      ]);
      setBuses(busesRes.data.buses);
      setRoutes(routesRes.data.routes);
      setBookings(bookingsRes.data.bookings);
      setStats(statsRes.data);
    } catch (error: any) {
      toast.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCities = async () => {
    try {
      const res = await api.get('/api/operator/cities');
      setCities(res.data.cities);
    } catch {
      // Silently fail
    }
  };

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!busForm.name || !busForm.bus_number) {
      toast.error('Bus name and number are required');
      return;
    }

    const amenities = busForm.amenities
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    // Show payment dialog instead of directly submitting
    setPaymentDialog({
      formData: { ...busForm },
      amenities,
      show: true,
      processing: false,
      success: null,
    });
  };

  const handleConfirmPayment = async () => {
    // Capture current values to avoid stale closure issues
    const { formData, amenities } = paymentDialog;

    setPaymentDialog((prev) => ({ ...prev, processing: true }));

    // Simulate payment processing with a delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 95% success rate like the existing PaymentService
    const isSuccess = Math.random() < 0.95;

    if (!isSuccess) {
      setPaymentDialog((prev) => ({ ...prev, processing: false, success: false }));
      toast.error('Payment failed. Please try again.');
      return;
    }

    try {
      const res = await api.post('/api/operator/buses', {
        name: formData.name,
        bus_number: formData.bus_number,
        type: formData.type,
        total_seats: parseInt(String(formData.total_seats)),
        amenities,
      });

      setPaymentDialog((prev) => ({ ...prev, processing: false, success: true }));
      toast.success(`Bus "${res.data.bus.name}" registered successfully! Payment of ₹${SUBSCRIPTION_PRICE} completed.`, { duration: 5000 });

      // Reset form and navigate
      setTimeout(() => {
        setPaymentDialog({ formData: busForm, amenities: [], show: false, processing: false, success: null });
        setBusForm({ name: '', bus_number: '', type: 'Seater', total_seats: 40, amenities: '' });
        setActiveTab('buses');
        fetchData();
      }, 1500);
    } catch (error: any) {
      setPaymentDialog((prev) => ({ ...prev, processing: false, success: false }));
      toast.error(error.response?.data?.error || 'Failed to register bus');
    }
  };

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeForm.bus_id || !routeForm.origin_city_id || !routeForm.destination_city_id) {
      toast.error('Please fill all required fields');
      return;
    }

    if (routeForm.origin_city_id === routeForm.destination_city_id) {
      toast.error('Origin and destination must be different');
      return;
    }

    setCreatingRoute(true);
    try {
      const res = await api.post('/api/operator/routes', {
        bus_id: routeForm.bus_id,
        origin_city_id: parseInt(routeForm.origin_city_id),
        destination_city_id: parseInt(routeForm.destination_city_id),
        departure_time: routeForm.departure_time,
        arrival_time: routeForm.arrival_time,
        duration_minutes: parseInt(String(routeForm.duration_minutes)),
        fare: parseFloat(routeForm.fare),
        travel_date: routeForm.travel_date,
      });

      toast.success(`Route created with ${res.data.seats_created} seats!`);
      setRouteForm({
        bus_id: '',
        origin_city_id: '',
        destination_city_id: '',
        departure_time: '08:00',
        arrival_time: '12:00',
        duration_minutes: 240,
        fare: '500',
        travel_date: new Date().toISOString().split('T')[0],
      });
      setActiveTab('routes');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create route');
    } finally {
      setCreatingRoute(false);
    }
  };

  const handleDeleteBus = async (busId: string, busName: string) => {
    if (!confirm(`Delete "${busName}" and all its routes? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/operator/buses/${busId}`);
      toast.success('Bus deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete bus');
    }
  };

  const handleTempCancel = async () => {
    if (!cancelDialog) return;
    try {
      if (cancelAllUpcoming) {
        await api.patch(`/api/operator/buses/${cancelDialog.busId}/cancel-temp`, {});
        toast.success(`"${cancelDialog.busName}" cancelled for all upcoming dates`);
      } else if (cancelDateFrom && cancelDateUntil) {
        await api.patch(`/api/operator/buses/${cancelDialog.busId}/cancel-temp`, {
          from_date: cancelDateFrom,
          until_date: cancelDateUntil,
        });
        toast.success(`"${cancelDialog.busName}" cancelled from ${cancelDateFrom} to ${cancelDateUntil}`);
      } else if (cancelDateFrom) {
        await api.patch(`/api/operator/buses/${cancelDialog.busId}/cancel-temp`, {
          from_date: cancelDateFrom,
        });
        toast.success(`"${cancelDialog.busName}" cancelled on ${cancelDateFrom}`);
      } else {
        toast.error('Please select a date range or choose to cancel all upcoming');
        return;
      }
      setCancelDialog(null);
      setCancelDateFrom('');
      setCancelDateUntil('');
      setCancelAllUpcoming(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to cancel bus');
    }
  };

  const handleReactivate = async (busId: string, busName: string) => {
    try {
      await api.patch(`/api/operator/buses/${busId}/reactivate`);
      toast.success(`"${busName}" reactivated`);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reactivate bus');
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm('Delete this route and all its seats? This cannot be undone.')) return;
    try {
      await api.delete(`/api/operator/routes/${routeId}`);
      toast.success('Route deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete route');
    }
  };

  const toggleExpandBus = (busId: string) => {
    setExpandedBus(expandedBus === busId ? null : busId);
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-success';
      case 'cancelled': return 'text-error';
      case 'pending': return 'text-warning';
      default: return 'text-text-secondary';
    }
  };

  const tabs = [
    { key: 'buses', label: 'My Buses', icon: Bus },
    { key: 'routes', label: 'My Routes', icon: Route },
    { key: 'bookings', label: 'Bookings', icon: Users },
    { key: 'add-bus', label: 'Add Bus', icon: Plus },
    { key: 'add-route', label: 'Add Route', icon: Calendar },
  ] as const;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="spinner !w-10 !h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bus className="w-6 h-6 text-teal-400" />
              Operator Dashboard
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Manage your buses, routes, and bookings —{' '}
              <span className="text-teal-400">{user?.name}</span>
            </p>
          </div>
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <p className="text-2xl font-bold">{stats?.totalBuses ?? buses.length}</p>
            <p className="text-xs text-text-secondary">Total Buses</p>
          </div>
          <div className="card p-5">
            <p className="text-2xl font-bold">{stats?.totalRoutes ?? routes.length}</p>
            <p className="text-xs text-text-secondary">Active Routes</p>
          </div>
          <div className="card p-5">
            <p className="text-2xl font-bold">{stats?.totalBookings ?? bookings.length}</p>
            <p className="text-xs text-text-secondary">Total Bookings</p>
          </div>
          <div className="card p-5 min-w-0">
            <p className="text-2xl font-bold text-success truncate" title={`₹${(stats?.totalRevenue ?? 0).toLocaleString('en-IN')}`}>
              ₹{(stats?.totalRevenue ?? 0).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-text-secondary">Revenue</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/50'
                  : 'bg-navy-800 text-text-secondary border border-white/10 hover:border-white/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ==================== MY BUSES ==================== */}
        {activeTab === 'buses' && (
          <div className="space-y-4">
            {buses.length === 0 ? (
              <div className="card p-12 text-center">
                <Bus className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No buses yet</h3>
                <p className="text-text-secondary text-sm mb-4">
                  Register your first bus to start creating routes.
                </p>
                <button
                  onClick={() => setActiveTab('add-bus')}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Bus
                </button>
              </div>
            ) : (
              buses.map((bus) =>
                <div key={bus.id} className="card overflow-hidden">
                  <div
                    className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => toggleExpandBus(bus.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
                        <Bus className="w-6 h-6 text-teal-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{bus.name}</h3>
                          {bus.status === 'temporarily_cancelled' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20">
                              Temporarily Cancelled
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary">
                          {bus.bus_number} · {bus.type} · {bus.total_seats} seats
                        </p>
                        {bus.amenities?.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {bus.amenities.map((a) => (
                              <span key={a} className="text-[10px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full">
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-1">
                          <SubscriptionBadge busId={bus.id} onRenew={fetchData} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-text-secondary">{bus.upcoming_routes} upcoming routes</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 h-2 bg-navy-900 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full transition-all"
                              style={{ width: `${bus.occupancy_percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-secondary">{bus.occupancy_percentage}%</span>
                        </div>
                      </div>
                      {/* Temp cancel / reactivate button */}
                      {bus.status === 'temporarily_cancelled' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReactivate(bus.id, bus.name);
                          }}
                          className="p-2 rounded-lg hover:bg-success/10 text-text-secondary hover:text-success transition-all"
                          title="Reactivate bus"
                        >
                          <PlayCircle className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancelDialog({ busId: bus.id, busName: bus.name });
                            setCancelAllUpcoming(false);
                            setCancelDateFrom(new Date().toISOString().split('T')[0]);
                            setCancelDateUntil('');
                          }}
                          className="p-2 rounded-lg hover:bg-warning/10 text-text-secondary hover:text-warning transition-all"
                          title="Temporarily cancel bus"
                        >
                          <PauseCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBus(bus.id, bus.name);
                        }}
                        className="p-2 rounded-lg hover:bg-error/10 text-text-secondary hover:text-error transition-all"
                        title="Delete bus permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {expandedBus === bus.id ? (
                        <ChevronUp className="w-5 h-5 text-text-secondary" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-text-secondary" />
                      )}
                    </div>
                  </div>

                  {/* Expanded: routes for this bus */}
                  {expandedBus === bus.id && (
                    <div className="border-t border-white/5 px-6 py-4 space-y-2">
                      <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
                        Routes for this bus
                      </p>
                      {routes.filter((r) => r.bus_id === bus.id).length === 0 ? (
                        <p className="text-sm text-text-secondary">No routes created yet</p>
                      ) : (
                        routes
                          .filter((r) => r.bus_id === bus.id)
                          .slice(0, 5)
                          .map((route) => (
                            <div
                              key={route.id}
                              className="flex items-center justify-between py-2 px-3 rounded-lg bg-navy-900/50"
                            >
                              <div className="flex items-center gap-3 text-sm">
                                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                                <span>
                                  {route.origin_city}
                                  <ArrowRight className="w-3 h-3 inline mx-1 text-text-secondary" />
                                  {route.destination_city}
                                </span>
                                <span className="text-text-secondary">|</span>
                                <Clock className="w-3 h-3 text-text-secondary inline" />
                                <span className="text-text-secondary">
                                  {formatTime(route.departure_time)} - {formatTime(route.arrival_time)}
                                </span>
                                <span className="text-text-secondary">|</span>
                                <IndianRupee className="w-3 h-3 text-text-secondary inline" />
                                <span className="text-text-secondary">₹{route.fare}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-text-secondary">
                                  {route.booked_seats}/{route.total_seats} booked
                                </span>
                              </div>
                            </div>
                          ))
                      )}
                      {routes.filter((r) => r.bus_id === bus.id).length > 5 && (
                        <button
                          onClick={() => setActiveTab('routes')}
                          className="text-xs text-teal-400 hover:text-teal-300 mt-1"
                        >
                          View all {routes.filter((r) => r.bus_id === bus.id).length} routes →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {/* ==================== MY ROUTES ==================== */}
        {activeTab === 'routes' && (
          <div className="space-y-3">
            {routes.length === 0 ? (
              <div className="card p-12 text-center">
                <Route className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No routes yet</h3>
                <p className="text-text-secondary text-sm mb-4">
                  Create a route for one of your buses.
                </p>
                <button
                  onClick={() => setActiveTab('add-route')}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Route
                </button>
              </div>
            ) : (
              routes.map((route) => (
                <div key={route.id} className="card p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Bus className="w-4 h-4 text-teal-400" />
                        <span className="font-medium text-sm">{route.bus_name}</span>
                        <span className="text-xs text-text-secondary">({route.bus_number})</span>
                        <span className="badge text-[10px] px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded-full">
                          {route.bus_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-semibold">{route.origin_city}</span>
                        <ArrowRight className="w-4 h-4 text-text-secondary" />
                        <span className="font-semibold">{route.destination_city}</span>
                        <span className="text-text-secondary">|</span>
                        <Clock className="w-3.5 h-3.5 text-text-secondary" />
                        <span>{formatTime(route.departure_time)} - {formatTime(route.arrival_time)}</span>
                        <span className="text-text-secondary">({route.duration_minutes} min)</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                        <span>{formatDate(route.travel_date)}</span>
                        <span>Fare: ₹{route.fare}</span>
                        <span className={route.available_seats > 0 ? 'text-success' : 'text-error'}>
                          {route.available_seats} seats available
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRoute(route.id)}
                      className="p-2 rounded-lg hover:bg-error/10 text-text-secondary hover:text-error transition-all"
                      title="Delete route"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ==================== BOOKINGS ==================== */}
        {activeTab === 'bookings' && (
          <div>
            {bookings.length === 0 ? (
              <div className="card p-12 text-center">
                <Users className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No bookings yet</h3>
                <p className="text-text-secondary text-sm">
                  Bookings for your routes will appear here.
                </p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-4 text-text-secondary font-medium">User</th>
                        <th className="text-left p-4 text-text-secondary font-medium">Bus</th>
                        <th className="text-left p-4 text-text-secondary font-medium">Route</th>
                        <th className="text-left p-4 text-text-secondary font-medium">Date</th>
                        <th className="text-left p-4 text-text-secondary font-medium">Seats</th>
                        <th className="text-left p-4 text-text-secondary font-medium">Fare</th>
                        <th className="text-left p-4 text-text-secondary font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="p-4">
                            <p className="font-medium">{booking.user_name}</p>
                            <p className="text-xs text-text-secondary">{booking.user_email}</p>
                          </td>
                          <td className="p-4 text-xs">{booking.bus_name}</td>
                          <td className="p-4 text-sm">
                            {booking.origin_city} → {booking.destination_city}
                          </td>
                          <td className="p-4 text-xs text-text-secondary">
                            {formatDate(booking.travel_date)}<br />
                            {formatTime(booking.departure_time)}
                          </td>
                          <td className="p-4">{booking.seat_ids?.length || '-'}</td>
                          <td className="p-4">₹{booking.total_fare}</td>
                          <td className="p-4">
                            <span className={`font-medium capitalize ${getStatusColor(booking.status)}`}>
                              {booking.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== ADD BUS FORM ==================== */}
        {activeTab === 'add-bus' && (
          <div className="max-w-2xl mx-auto">
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                  <Bus className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Register a New Bus</h2>
                  <p className="text-xs text-text-secondary">
                    Add a bus to start creating routes and accepting bookings
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddBus} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Bus Name *</label>
                    <input
                      type="text"
                      value={busForm.name}
                      onChange={(e) => setBusForm({ ...busForm, name: e.target.value })}
                      placeholder="e.g. Rapid Express"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Bus Number *</label>
                    <input
                      type="text"
                      value={busForm.bus_number}
                      onChange={(e) => setBusForm({ ...busForm, bus_number: e.target.value })}
                      placeholder="e.g. MH-01-AB-1234"
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Bus Type *</label>
                    <select
                      value={busForm.type}
                      onChange={(e) => setBusForm({ ...busForm, type: e.target.value })}
                      className="input-field"
                    >
                      <option value="Seater">Seater</option>
                      <option value="Semi-Sleeper">Semi-Sleeper</option>
                      <option value="Sleeper">Sleeper</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Total Seats *</label>
                    <input
                      type="number"
                      value={busForm.total_seats}
                      onChange={(e) => setBusForm({ ...busForm, total_seats: parseInt(e.target.value) || 40 })}
                      min={10}
                      max={60}
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Amenities <span className="text-text-secondary">(comma separated)</span>
                  </label>
                  <input
                    type="text"
                    value={busForm.amenities}
                    onChange={(e) => setBusForm({ ...busForm, amenities: e.target.value })}
                    placeholder="e.g. AC, WiFi, USB Charging, Blanket"
                    className="input-field"
                  />
                  {busForm.amenities && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {busForm.amenities.split(',').map((a, i) => a.trim() && (
                        <span key={i} className="text-[10px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full">
                          {a.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button type="submit" className="btn-primary w-full">
                  <Plus className="w-4 h-4" />
                  Register Bus
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================== TEMP CANCEL DIALOG ==================== */}
        {cancelDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setCancelDialog(null)} />
            <div className="relative bg-navy-900 rounded-xl p-6 max-w-md w-full border border-white/10 animate-slide-up">
              <h3 className="text-lg font-semibold mb-2">Temporarily Cancel Bus</h3>
              <p className="text-sm text-text-secondary mb-4">
                Choose how you want to cancel <span className="text-teal-400 font-medium">{cancelDialog.busName}</span>.
                Your routes will still exist but won't be bookable by passengers.
              </p>

              <div className="space-y-4">
                {/* Cancel all upcoming */}
                <label className="flex items-start gap-3 p-4 rounded-xl bg-navy-800 border border-white/10 cursor-pointer hover:border-teal-400/30 transition-colors">
                  <input
                    type="radio"
                    name="cancelType"
                    checked={cancelAllUpcoming}
                    onChange={() => {
                      setCancelAllUpcoming(true);
                      setCancelDateFrom('');
                      setCancelDateUntil('');
                    }}
                    className="mt-1 accent-teal-500"
                  />
                  <div>
                    <p className="text-sm font-medium">Cancel all upcoming</p>
                    <p className="text-xs text-text-secondary">The bus won't be available for any future dates until you reactivate it.</p>
                  </div>
                </label>

                {/* Cancel by date range */}
                <label className="flex items-start gap-3 p-4 rounded-xl bg-navy-800 border border-white/10 cursor-pointer hover:border-teal-400/30 transition-colors">
                  <input
                    type="radio"
                    name="cancelType"
                    checked={!cancelAllUpcoming}
                    onChange={() => {
                      setCancelAllUpcoming(false);
                      setCancelDateFrom(new Date().toISOString().split('T')[0]);
                    }}
                    className="mt-1 accent-teal-500"
                  />
                  <div>
                    <p className="text-sm font-medium">Cancel for a date range</p>
                    <p className="text-xs text-text-secondary">Specify the dates when the bus should be unavailable.</p>
                  </div>
                </label>

                {!cancelAllUpcoming && (
                  <div className="grid grid-cols-2 gap-3 pl-7">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">From Date *</label>
                      <input
                        type="date"
                        value={cancelDateFrom}
                        onChange={(e) => setCancelDateFrom(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Until Date</label>
                      <input
                        type="date"
                        value={cancelDateUntil}
                        onChange={(e) => setCancelDateUntil(e.target.value)}
                        min={cancelDateFrom || new Date().toISOString().split('T')[0]}
                        className="input-field text-sm"
                      />
                      <p className="text-[10px] text-text-secondary mt-1">Leave empty for a single day</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setCancelDialog(null)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={handleTempCancel} className="btn-danger flex-1 flex items-center justify-center gap-2">
                  <PauseCircle className="w-4 h-4" />
                  {cancelAllUpcoming ? 'Cancel All Upcoming' : 'Cancel for Selected Dates'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== PAYMENT DIALOG ==================== */}
        {paymentDialog.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => {
              if (!paymentDialog.processing && paymentDialog.success === null) {
                setPaymentDialog((prev) => ({ ...prev, show: false }));
              }
            }} />
            <div className="relative bg-navy-900 rounded-xl p-6 max-w-md w-full border border-white/10 animate-slide-up">
              {/* Success state */}
              {paymentDialog.success === true ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-success" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Payment Successful! 🎉</h3>
                  <p className="text-sm text-text-secondary">
                    Bus "{paymentDialog.formData.name}" registered with subscription active for {SUBSCRIPTION_DAYS} days.
                  </p>
                </div>
              ) : paymentDialog.success === false ? (
                /* Failed state */
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-error" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Payment Failed</h3>
                  <p className="text-sm text-text-secondary mb-4">
                    The simulated payment could not be processed. Please try again.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentDialog((prev) => ({ ...prev, show: false, success: null }))}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button onClick={handleConfirmPayment} className="btn-primary flex-1">
                      Retry Payment
                    </button>
                  </div>
                </div>
              ) : (
                /* Payment prompt */
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Complete Registration</h3>
                      <p className="text-xs text-text-secondary">
                        Pay subscription fee to list your bus on RapidRoute
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="p-4 rounded-xl bg-navy-800 border border-white/10">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-text-secondary">Bus</span>
                        <span className="font-medium">{paymentDialog.formData.name} ({paymentDialog.formData.bus_number})</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-text-secondary">Type</span>
                        <span>{paymentDialog.formData.type} · {paymentDialog.formData.total_seats} seats</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-text-secondary">Subscription</span>
                        <span>{SUBSCRIPTION_DAYS} days listing</span>
                      </div>
                      <div className="border-t border-white/10 my-2" />
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Subscription Fee</span>
                        <span className="text-teal-400">₹{SUBSCRIPTION_PRICE.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
                      <p>⚠ Demo payment simulation. No real charges will be made. 95% success rate for demo purposes.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentDialog((prev) => ({ ...prev, show: false }))}
                      disabled={paymentDialog.processing}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmPayment}
                      disabled={paymentDialog.processing}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      {paymentDialog.processing ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Processing Payment...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Pay ₹{SUBSCRIPTION_PRICE.toLocaleString('en-IN')}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ==================== ADD ROUTE FORM ==================== */}
        {activeTab === 'add-route' && (
          <div className="max-w-2xl mx-auto">
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                  <Route className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Create a New Route</h2>
                  <p className="text-xs text-text-secondary">
                    Define a route for one of your registered buses
                  </p>
                </div>
              </div>

              {buses.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-3" />
                  <p className="text-sm text-text-secondary mb-4">
                    You need to register a bus first before creating routes.
                  </p>
                  <button onClick={() => setActiveTab('add-bus')} className="btn-primary">
                    Register a Bus
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddRoute} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Select Bus *</label>
                    <select
                      value={routeForm.bus_id}
                      onChange={(e) => setRouteForm({ ...routeForm, bus_id: e.target.value })}
                      className="input-field"
                    >
                      <option value="">Choose a bus...</option>
                      {buses.map((bus) => (
                        <option key={bus.id} value={bus.id}>
                          {bus.name} ({bus.bus_number}) — {bus.type} — {bus.total_seats} seats
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Origin City *</label>
                      <select
                        value={routeForm.origin_city_id}
                        onChange={(e) => setRouteForm({ ...routeForm, origin_city_id: e.target.value })}
                        className="input-field"
                      >
                        <option value="">Select origin...</option>
                        {cities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.name}, {city.state}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Destination City *</label>
                      <select
                        value={routeForm.destination_city_id}
                        onChange={(e) => setRouteForm({ ...routeForm, destination_city_id: e.target.value })}
                        className="input-field"
                      >
                        <option value="">Select destination...</option>
                        {cities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.name}, {city.state}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Departure Time *</label>
                      <input
                        type="time"
                        value={routeForm.departure_time}
                        onChange={(e) => setRouteForm({ ...routeForm, departure_time: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Arrival Time *</label>
                      <input
                        type="time"
                        value={routeForm.arrival_time}
                        onChange={(e) => setRouteForm({ ...routeForm, arrival_time: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Duration (min)</label>
                      <input
                        type="number"
                        value={routeForm.duration_minutes}
                        onChange={(e) => setRouteForm({ ...routeForm, duration_minutes: parseInt(e.target.value) || 0 })}
                        className="input-field"
                        placeholder="Auto-calculated"
                      />
                      <p className="text-[10px] text-text-secondary mt-1">
                        Leave blank for auto-calculation
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Fare (₹) *</label>
                      <input
                        type="number"
                        value={routeForm.fare}
                        onChange={(e) => setRouteForm({ ...routeForm, fare: e.target.value })}
                        min={0}
                        step={50}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Travel Date *</label>
                      <input
                        type="date"
                        value={routeForm.travel_date}
                        onChange={(e) => setRouteForm({ ...routeForm, travel_date: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={creatingRoute}
                    className="btn-primary w-full"
                  >
                    {creatingRoute ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="spinner !w-5 !h-5" />
                        Creating route with seats...
                      </span>
                    ) : (
                      <>
                        <Calendar className="w-4 h-4" />
                        Create Route & Generate Seats
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
