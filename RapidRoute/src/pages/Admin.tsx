import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  IndianRupee,
  Clock,
  Bus,
  AlertTriangle,
  RefreshCw,
  Activity,
  BarChart3,
  RotateCw,
  Building2,
  Settings,
  DollarSign,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useNavigate, Link } from 'react-router-dom';

interface Stats {
  bookingsToday: number;
  revenueToday: number;
  adminRevenue: number;
  activeHolds: number;
  availableSeats: number;
  totalOperators: number;
}

interface Booking {
  id: string;
  user_name: string;
  user_email: string;
  origin_city: string;
  destination_city: string;
  bus_name: string;
  seat_ids: string[];
  passenger_names: string[];
  total_fare: number;
  status: string;
  created_at: string;
}

interface Hold {
  seat_id: string;
  seat_number: string;
  deck: string;
  held_by_name: string;
  held_by_email: string;
  origin_city: string;
  destination_city: string;
  minutes_remaining: number;
  held_until: string;
}

interface Bus {
  id: string;
  name: string;
  bus_number: string;
  type: string;
  total_seats: number;
  active_routes: number;
  booked_seats: number;
  held_seats: number;
  occupancy_percentage: number;
  operator_name?: string;
  operator_email?: string;
  status?: string;
}

interface Operator {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  total_buses: number;
  active_buses: number;
  total_subscription_revenue: number;
}

interface Subscription {
  id: string;
  bus_id: string;
  operator_id: string;
  start_date: string;
  end_date: string;
  amount_paid: number;
  status: string;
  bus_name: string;
  bus_number: string;
  operator_name: string;
  operator_email: string;
}

interface RevenueData {
  totalRevenue: number;
  activeSubscriptions: number;
  monthlyRevenue: { month: string; total: number; count: number }[];
  recentPayments: { id: string; amount_paid: number; created_at: string; status: string; bus_name: string; operator_name: string }[];
}

export default function Admin() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState<Stats>({
    bookingsToday: 0,
    revenueToday: 0,
    adminRevenue: 0,
    activeHolds: 0,
    availableSeats: 0,
    totalOperators: 0,
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bookings' | 'holds' | 'buses' | 'refunds' | 'operators' | 'revenue' | 'settings'>('bookings');
  const [refundStats, setRefundStats] = useState<any>(null);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [expandedOperator, setExpandedOperator] = useState<string | null>(null);
  const [operatorBuses, setOperatorBuses] = useState<Record<string, any[]>>({});
  const [editingPrice, setEditingPrice] = useState(false);
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
    fetchAllData();
  }, [isAuthenticated, user]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, bookingsRes, holdsRes, busesRes, refundsRes, operatorsRes, subsRes, revenueRes, settingsRes] =
        await Promise.all([
          api.get('/api/admin/stats'),
          api.get('/api/admin/bookings'),
          api.get('/api/admin/holds'),
          api.get('/api/admin/buses'),
          api.get('/api/admin/refunds'),
          api.get('/api/admin/operators'),
          api.get('/api/admin/subscribers'),
          api.get('/api/admin/revenue'),
          api.get('/api/admin/settings'),
        ]);
      setStats(statsRes.data);
      setBookings(bookingsRes.data.bookings);
      setHolds(holdsRes.data.holds);
      setBuses(busesRes.data.buses);
      setRefundStats(refundsRes.data);
      setOperators(operatorsRes.data.operators);
      setSubscriptions(subsRes.data.subscriptions);
      setRevenueData(revenueRes.data);
      setSettings(settingsRes.data.settings);
    } catch (error: any) {
      toast.error('Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatMinutes = (minutes: number) => {
    if (minutes <= 0) return 'Expired';
    if (minutes < 1) return 'Less than 1 min';
    const mins = Math.floor(minutes);
    return `${mins} min`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-success';
      case 'cancelled': return 'text-error';
      case 'pending': return 'text-warning';
      default: return 'text-text-secondary';
    }
  };

  const handleDeleteBus = async (busId: string) => {
    if (!confirm('Delete this bus permanently? This action cannot be undone.')) return;
    try {
      await api.delete(`/api/admin/buses/${busId}`);
      toast.success('Bus deleted');
      fetchAllData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete bus');
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      await api.put(`/api/admin/settings/${key}`, { value });
      toast.success('Setting updated');
      setEditingPrice(false);
      fetchAllData();
    } catch (error: any) {
      toast.error('Failed to update setting');
    }
  };

  const toggleExpandOperator = async (operatorId: string) => {
    if (expandedOperator === operatorId) {
      setExpandedOperator(null);
      return;
    }
    setExpandedOperator(operatorId);
    try {
      const res = await api.get(`/api/admin/operators/${operatorId}/buses`);
      setOperatorBuses((prev) => ({ ...prev, [operatorId]: res.data.buses }));
    } catch {
      toast.error('Failed to fetch operator buses');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="spinner !w-10 !h-10" />
      </div>
    );
  }

  const tabs = [
    { key: 'bookings', label: 'All Bookings', icon: LayoutDashboard },
    { key: 'holds', label: 'Active Holds', icon: Clock },
    { key: 'buses', label: 'Bus Utilization', icon: Bus },
    { key: 'operators', label: 'Operators', icon: Building2 },
    { key: 'revenue', label: 'Revenue', icon: DollarSign },
    { key: 'refunds', label: 'Refunds', icon: IndianRupee },
    { key: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-teal-400" />
              Admin Dashboard
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Manage operators, buses, subscriptions, and settings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/performance"
              className="btn-primary flex items-center gap-2 text-sm bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30 px-4 py-2 rounded-lg transition-all"
            >
              <BarChart3 className="w-4 h-4" />
              Performance
            </Link>
            <button onClick={fetchAllData} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <p className="text-2xl font-bold">{stats.bookingsToday}</p>
            <p className="text-xs text-text-secondary">Bookings Today</p>
          </div>
          <div className="card p-5">
            <p className="text-2xl font-bold">₹{stats.revenueToday.toLocaleString()}</p>
            <p className="text-xs text-text-secondary">Revenue Today</p>
          </div>
          <div className="card p-5">
            <p className="text-2xl font-bold text-teal-400">₹{(stats.adminRevenue || 0).toLocaleString()}</p>
            <p className="text-xs text-text-secondary">Subscription Revenue</p>
          </div>
          <div className="card p-5">
            <p className="text-2xl font-bold">{stats.totalOperators}</p>
            <p className="text-xs text-text-secondary">Total Operators</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all capitalize ${
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

        {/* ==================== BOOKINGS ==================== */}
        {activeTab === 'bookings' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-text-secondary font-medium">Booking ID</th>
                    <th className="text-left p-4 text-text-secondary font-medium">User</th>
                    <th className="text-left p-4 text-text-secondary font-medium">Route</th>
                    <th className="text-left p-4 text-text-secondary font-medium">Seats</th>
                    <th className="text-left p-4 text-text-secondary font-medium">Fare</th>
                    <th className="text-left p-4 text-text-secondary font-medium">Status</th>
                    <th className="text-left p-4 text-text-secondary font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-mono text-xs">{booking.id.slice(0, 8)}...</td>
                      <td className="p-4">
                        <p className="font-medium">{booking.user_name}</p>
                        <p className="text-xs text-text-secondary">{booking.user_email}</p>
                      </td>
                      <td className="p-4">
                        <p>{booking.origin_city} → {booking.destination_city}</p>
                        <p className="text-xs text-text-secondary">{booking.bus_name}</p>
                      </td>
                      <td className="p-4">{booking.seat_ids?.length || '-'}</td>
                      <td className="p-4">₹{booking.total_fare}</td>
                      <td className="p-4">
                        <span className={`font-medium capitalize ${getStatusColor(booking.status)}`}>{booking.status}</span>
                      </td>
                      <td className="p-4 text-xs text-text-secondary">{formatTime(booking.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== HOLDS ==================== */}
        {activeTab === 'holds' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-text-secondary font-medium">Seat ID</th>
                    <th className="text-left p-4 text-text-secondary font-medium">Seat</th>
                    <th className="text-left p-4 text-text-secondary font-medium">Held By</th>
                    <th className="text-left p-4 text-text-secondary font-medium">Route</th>
                    <th className="text-left p-4 text-text-secondary font-medium">Held Until</th>
                    <th className="text-left p-4 text-text-secondary font-medium">Countdown</th>
                  </tr>
                </thead>
                <tbody>
                  {holds.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-text-secondary">No active holds</td>
                    </tr>
                  ) : (
                    holds.map((hold) => (
                      <tr key={hold.seat_id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-mono text-xs">{hold.seat_id.slice(0, 8)}...</td>
                        <td className="p-4">
                          <span className="badge-held px-2 py-0.5 text-xs">{hold.seat_number} ({hold.deck})</span>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">{hold.held_by_name}</p>
                          <p className="text-xs text-text-secondary">{hold.held_by_email}</p>
                        </td>
                        <td className="p-4 text-sm">{hold.origin_city} → {hold.destination_city}</td>
                        <td className="p-4 text-xs text-text-secondary">{formatTime(hold.held_until)}</td>
                        <td className="p-4">
                          <span className={`font-mono font-bold ${
                            hold.minutes_remaining < 3 ? 'text-error' : hold.minutes_remaining < 5 ? 'text-warning' : 'text-success'
                          }`}>
                            {formatMinutes(hold.minutes_remaining)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== REFUNDS ==================== */}
        {activeTab === 'refunds' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card p-5">
                <p className="text-xs text-text-secondary mb-1">Refunds Today</p>
                <p className="text-2xl font-bold">{refundStats?.todayRefunds?.count || 0}</p>
              </div>
              <div className="card p-5">
                <p className="text-xs text-text-secondary mb-1">Total Refund Amount Today</p>
                <p className="text-2xl font-bold text-teal-400">₹{(refundStats?.todayRefunds?.total_amount || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold mb-4">Refunds by Tier</h3>
              {refundStats?.byTier?.length > 0 ? (
                <div className="space-y-3">
                  {refundStats.byTier.map((tier: any) => {
                    const maxCount = Math.max(...refundStats.byTier.map((t: any) => t.count));
                    const barWidth = maxCount > 0 ? (tier.count / maxCount) * 100 : 0;
                    return (
                      <div key={tier.tier_name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-text-secondary">{tier.tier_name}</span>
                          <span className="font-medium">{tier.count} refunds (₹{parseFloat(tier.total_amount).toLocaleString('en-IN')})</span>
                        </div>
                        <div className="w-full bg-navy-900 rounded-full h-2.5 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (<p className="text-sm text-text-secondary">No refunds processed yet</p>)}
            </div>
            <div className="card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-error" /> Failed Refunds
              </h3>
              {refundStats?.failedRefunds?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-2 text-text-secondary font-medium">Booking ID</th>
                        <th className="text-left p-2 text-text-secondary font-medium">Amount</th>
                        <th className="text-left p-2 text-text-secondary font-medium">Reason</th>
                        <th className="text-left p-2 text-text-secondary font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refundStats.failedRefunds.map((refund: any) => (
                        <tr key={refund.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="p-2 font-mono text-xs">{refund.booking_id?.slice(0, 8)}...</td>
                          <td className="p-2 text-xs">₹{refund.refund_amount}</td>
                          <td className="p-2 text-xs text-error">{refund.failure_reason || 'Unknown'}</td>
                          <td className="p-2">
                            <button onClick={async () => {
                              setReprocessing(refund.id);
                              try {
                                const res = await api.post(`/api/admin/refunds/${refund.id}/reprocess`);
                                if (res.data.success) { toast.success('Refund reprocessed'); fetchAllData(); }
                                else { toast.error(res.data.message); }
                              } catch { toast.error('Failed to reprocess'); }
                              finally { setReprocessing(null); }
                            }} disabled={reprocessing === refund.id}
                              className="text-xs px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30 transition-colors flex items-center gap-1">
                              <RotateCw className={`w-3 h-3 ${reprocessing === refund.id ? 'animate-spin' : ''}`} /> Reprocess
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (<p className="text-sm text-text-secondary">No failed refunds</p>)}
            </div>
          </div>
        )}

        {/* ==================== BUSES ==================== */}
        {activeTab === 'buses' && (
          <div className="space-y-4">
            {buses.map((bus) => (
              <div key={bus.id} className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{bus.name}</h3>
                    <p className="text-xs text-text-secondary">
                      {bus.bus_number} · {bus.type} · {bus.total_seats} seats
                      {bus.operator_name && <span className="ml-2 text-teal-400">by {bus.operator_name}</span>}
                      {bus.status === 'temporarily_cancelled' && (
                        <span className="ml-2 text-error">⚠ Temporarily Cancelled</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-teal-400">{bus.occupancy_percentage}%</p>
                    <p className="text-xs text-text-secondary">Occupancy</p>
                  </div>
                </div>
                <div className="w-full bg-navy-900 rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all" style={{ width: `${bus.occupancy_percentage}%` }} />
                </div>
                <div className="flex gap-6 mt-4 text-sm items-center">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-error/50" /><span className="text-text-secondary">{bus.booked_seats} Booked</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-warning/50" /><span className="text-text-secondary">{bus.held_seats} Held</span></div>
                  <div className="flex-1" />
                  <button onClick={() => handleDeleteBus(bus.id)} className="p-2 rounded-lg hover:bg-error/10 text-text-secondary hover:text-error transition-all" title="Delete bus">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ==================== OPERATORS ==================== */}
        {activeTab === 'operators' && (
          <div className="space-y-4">
            {operators.length === 0 ? (
              <div className="card p-12 text-center">
                <Building2 className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No operators yet</h3>
                <p className="text-text-secondary text-sm">Operators who register will appear here.</p>
              </div>
            ) : (
              operators.map((op) => (
                <div key={op.id} className="card overflow-hidden">
                  <div
                    className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => toggleExpandOperator(op.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-teal-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{op.name}</h3>
                        <p className="text-xs text-text-secondary">{op.email} · {op.phone || 'No phone'}</p>
                        <div className="flex gap-3 mt-1 text-xs text-text-secondary">
                          <span>{op.total_buses} total buses</span>
                          <span className="text-success">{op.active_buses} active</span>
                          <span>₹{op.total_subscription_revenue} paid</span>
                        </div>
                      </div>
                    </div>
                    {expandedOperator === op.id ? <ChevronUp className="w-5 h-5 text-text-secondary" /> : <ChevronDown className="w-5 h-5 text-text-secondary" />}
                  </div>

                  {expandedOperator === op.id && (
                    <div className="border-t border-white/5 px-6 py-4 space-y-2">
                      <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">Buses for {op.name}</p>
                      {!operatorBuses[op.id] || operatorBuses[op.id].length === 0 ? (
                        <p className="text-sm text-text-secondary">No buses found</p>
                      ) : (
                        operatorBuses[op.id].map((bus: any) => (
                          <div key={bus.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-navy-900/50">
                            <div className="flex items-center gap-3 text-sm">
                              <Bus className="w-4 h-4 text-teal-400" />
                              <span className="font-medium">{bus.name}</span>
                              <span className="text-text-secondary">({bus.bus_number})</span>
                              <span className="text-text-secondary">·</span>
                              <span>{bus.total_seats} seats</span>
                              {bus.status === 'temporarily_cancelled' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-error/10 text-error">Cancelled</span>
                              )}
                              {bus.subscription_status !== 'active' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">Sub expired</span>
                              )}
                            </div>
                            <button onClick={() => handleDeleteBus(bus.id)} className="p-1.5 rounded-lg hover:bg-error/10 text-text-secondary hover:text-error transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ==================== REVENUE ==================== */}
        {activeTab === 'revenue' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-5">
                <p className="text-xs text-text-secondary mb-1">Total Subscription Revenue</p>
                <p className="text-2xl font-bold text-teal-400">₹{(revenueData?.totalRevenue || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="card p-5">
                <p className="text-xs text-text-secondary mb-1">Active Subscriptions</p>
                <p className="text-2xl font-bold">{revenueData?.activeSubscriptions || 0}</p>
              </div>
              <div className="card p-5">
                <p className="text-xs text-text-secondary mb-1">Monthly Revenue</p>
                <p className="text-2xl font-bold">
                  ₹{(revenueData?.monthlyRevenue?.[0]?.total || 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Monthly Revenue Chart */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4">Monthly Revenue</h3>
              {revenueData?.monthlyRevenue && revenueData.monthlyRevenue.length > 0 ? (
                <div className="space-y-3">
                  {revenueData.monthlyRevenue.map((month) => {
                    const maxAmount = Math.max(...revenueData.monthlyRevenue.map((m) => m.total));
                    const barWidth = maxAmount > 0 ? (month.total / maxAmount) * 100 : 0;
                    return (
                      <div key={month.month}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-text-secondary">{new Date(month.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                          <span className="font-medium">₹{month.total.toLocaleString('en-IN')} ({month.count} subs)</span>
                        </div>
                        <div className="w-full bg-navy-900 rounded-full h-2.5 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (<p className="text-sm text-text-secondary">No subscription payments yet</p>)}
            </div>

            {/* Recent Payments */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4">Recent Subscription Payments</h3>
              {revenueData?.recentPayments && revenueData.recentPayments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-2 text-text-secondary font-medium">Operator</th>
                        <th className="text-left p-2 text-text-secondary font-medium">Bus</th>
                        <th className="text-left p-2 text-text-secondary font-medium">Amount</th>
                        <th className="text-left p-2 text-text-secondary font-medium">Date</th>
                        <th className="text-left p-2 text-text-secondary font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueData.recentPayments.map((payment) => (
                        <tr key={payment.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="p-2 text-xs">{payment.operator_name}</td>
                          <td className="p-2 text-xs">{payment.bus_name}</td>
                          <td className="p-2 text-xs font-medium">₹{payment.amount_paid}</td>
                          <td className="p-2 text-xs text-text-secondary">{formatDate(payment.created_at)}</td>
                          <td className="p-2 text-xs"><span className={`capitalize ${payment.status === 'active' ? 'text-success' : 'text-warning'}`}>{payment.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (<p className="text-sm text-text-secondary">No payments yet</p>)}
            </div>
          </div>
        )}

        {/* ==================== SETTINGS ==================== */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto">
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-6 h-6 text-teal-400" />
                <h2 className="text-lg font-bold">Platform Settings</h2>
              </div>

              <div className="space-y-6">
                {/* Subscription Price */}
                <div className="p-5 rounded-xl bg-navy-800 border border-white/10">
                  <label className="block text-sm font-medium text-text-secondary mb-1">Bus Subscription Price (₹)</label>
                  <p className="text-xs text-text-secondary mb-3">
                    Amount operators pay to list a bus on the platform for the subscription period.
                  </p>
                  {editingPrice ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        min={0}
                        step={100}
                        className="input-field w-40"
                      />
                      <button onClick={() => handleUpdateSetting('subscription_price', newPrice)} className="btn-primary text-sm">
                        Save
                      </button>
                      <button onClick={() => setEditingPrice(false)} className="btn-secondary text-sm">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold">₹{settings.subscription_price || '4000'}</p>
                      <button
                        onClick={() => { setNewPrice(settings.subscription_price || '4000'); setEditingPrice(true); }}
                        className="btn-secondary text-sm"
                      >
                        Change Price
                      </button>
                    </div>
                  )}
                </div>

                {/* Subscription Duration */}
                <div className="p-5 rounded-xl bg-navy-800 border border-white/10">
                  <label className="block text-sm font-medium text-text-secondary mb-1">Subscription Duration (Days)</label>
                  <p className="text-xs text-text-secondary mb-3">
                    How many days a bus subscription lasts before requiring renewal.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      defaultValue={settings.subscription_duration_days || '180'}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== settings.subscription_duration_days) {
                          handleUpdateSetting('subscription_duration_days', e.target.value);
                        }
                      }}
                      min={30}
                      max={730}
                      step={30}
                      className="input-field w-40"
                    />
                    <span className="text-sm text-text-secondary">days (~{(parseInt(settings.subscription_duration_days || '180') / 30).toFixed(0)} months)</span>
                  </div>
                </div>

                {/* Admin Credentials */}
                <div className="p-5 rounded-xl bg-navy-800 border border-white/10">
                  <label className="block text-sm font-medium text-text-secondary mb-1">Admin Credentials</label>
                  <p className="text-xs text-text-secondary">Use these to login as admin:</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="text-text-secondary">Email:</span> <span className="font-mono text-teal-400">admin@rapidroute.com</span></p>
                    <p><span className="text-text-secondary">Password:</span> <span className="font-mono text-teal-400">admin123</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}