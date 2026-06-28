/**
 * Performance Dashboard — Real-time system reliability & performance visualization.
 *
 * Displays live metrics: request throughput chart, DB pool health, worker pool status,
 * seat holds, rate limit blocks, idempotency cache hit rate, AI assistant stats,
 * concurrency events timeline, and message queue stats.
 * Auto-refreshes every 3 seconds via polling GET /api/admin/metrics.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  Database,
  Cpu,
  Clock,
  ShieldAlert,
  BarChart3,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Layers,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

interface Metrics {
  throughput: Record<string, number>;
  requestHistory: Record<string, number>[];
  dbPool: {
    activeConnections: number;
    maxConnections: number;
    queueDepth: number;
    avgQueryTimeMs: number;
  };
  rateLimiter: {
    totalBlocked: number;
    recentBlocks: {
      timestamp: number;
      userId: string;
      email: string;
      endpoint: string;
      retryAfter: number;
    }[];
  };
  idempotency: {
    hits: number;
    misses: number;
    cacheHitRate: number;
  };
  seatHolds: {
    currentHeld: number;
    expiredLastMinute: number;
  };
  aiAssistant: {
    totalQueries: number;
    avgResponseTimeMs: number;
    errors: number;
  };
  concurrencyEvents: {
    timestamp: number;
    type: string;
    details: string;
  }[];
  workerPool: {
    totalWorkers: number;
    activeWorkers: number;
    queueDepth: number;
    tasksCompleted: number;
    tasksFailed: number;
  };
  queueStats: {
    published: number;
    consumed: number;
    deadLettered: number;
  };
}

const INITIAL_METRICS: Metrics = {
  throughput: {},
  requestHistory: [],
  dbPool: { activeConnections: 0, maxConnections: 10, queueDepth: 0, avgQueryTimeMs: 0 },
  rateLimiter: { totalBlocked: 0, recentBlocks: [] },
  idempotency: { hits: 0, misses: 0, cacheHitRate: 0 },
  seatHolds: { currentHeld: 0, expiredLastMinute: 0 },
  aiAssistant: { totalQueries: 0, avgResponseTimeMs: 0, errors: 0 },
  concurrencyEvents: [],
  workerPool: { totalWorkers: 4, activeWorkers: 0, queueDepth: 0, tasksCompleted: 0, tasksFailed: 0 },
  queueStats: { published: 0, consumed: 0, deadLettered: 0 },
};

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// Color coding for metric values
const dbColor = (ratio: number) => {
  if (ratio < 0.5) return 'text-success';
  if (ratio < 0.8) return 'text-warning';
  return 'text-error';
};

const aiColor = (ms: number) => {
  if (ms < 1000) return 'text-success';
  if (ms < 3000) return 'text-warning';
  return 'text-error';
};

export default function Performance() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metrics>(INITIAL_METRICS);
  const [loading, setLoading] = useState(true);
  const [prevHolds, setPrevHolds] = useState(0);
  const holdsRef = useRef(0);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/metrics');
      const data = res.data;
      setPrevHolds(holdsRef.current);
      holdsRef.current = data.seatHolds.currentHeld;
      setMetrics(data);
    } catch (error: any) {
      console.error('[Performance] Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchMetrics, navigate]);

  const holdTrend = metrics.seatHolds.currentHeld - prevHolds;
  const holdIsUp = holdTrend > 0;

  const dbRatio = metrics.dbPool.maxConnections > 0
    ? metrics.dbPool.activeConnections / metrics.dbPool.maxConnections
    : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-teal-400" />
              Performance & Reliability
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Real-time system metrics — auto-refreshing every 3 seconds
            </p>
          </div>
          <button
            onClick={fetchMetrics}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center">
            <div className="spinner !w-10 !h-10" />
          </div>
        ) : (
          <>
            {/* Metric Cards — 3x2 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {/* 1. DB Pool Health */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-teal-400" />
                    <h3 className="text-sm font-semibold">DB Pool Health</h3>
                  </div>                    <span className={`text-xs font-bold ${dbColor(dbRatio)}`}>
                    {metrics.dbPool.activeConnections}/{metrics.dbPool.maxConnections}
                  </span>
                </div>
                <div className="w-full bg-navy-900 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      dbRatio < 0.5
                        ? 'bg-success'
                        : dbRatio < 0.8
                        ? 'bg-warning'
                        : 'bg-error'
                    }`}
                    style={{ width: `${dbRatio * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-text-secondary">
                  <span>Queue: {metrics.dbPool.queueDepth}</span>
                  <span>Avg query: {metrics.dbPool.avgQueryTimeMs}ms</span>
                </div>
              </div>

              {/* 2. Worker Pool Status */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-teal-400" />
                    <h3 className="text-sm font-semibold">Worker Pool</h3>
                  </div>
                  <span className="text-xs text-text-secondary">
                    {metrics.workerPool.activeWorkers}/{metrics.workerPool.totalWorkers}
                  </span>
                </div>
                <div className="flex gap-1.5 mb-3">
                  {Array.from({ length: metrics.workerPool.totalWorkers }, (_, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        i < metrics.workerPool.activeWorkers
                          ? 'bg-teal-500/20 text-teal-400 border border-teal-500/50 animate-pulse'
                          : 'bg-navy-900 text-text-secondary border border-white/10'
                      }`}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-text-secondary">
                  <span>Queue depth: {metrics.workerPool.queueDepth}</span>
                  <span>Failed: {metrics.workerPool.tasksFailed}</span>
                  <span>Completed: {metrics.workerPool.tasksCompleted}</span>
                  <span>Total: {metrics.workerPool.tasksCompleted + metrics.workerPool.tasksFailed}</span>
                </div>
              </div>

              {/* 3. Active Seat Holds */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-teal-400" />
                    <h3 className="text-sm font-semibold">Active Seat Holds</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold">{metrics.seatHolds.currentHeld}</span>
                    {holdTrend !== 0 && (
                      <span className={`flex items-center text-xs ${holdIsUp ? 'text-warning' : 'text-success'}`}>
                        {holdIsUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(holdTrend)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-text-secondary">
                  <span>Expired (1m): {metrics.seatHolds.expiredLastMinute}</span>
                  <span>Hold duration: 10 min</span>
                </div>
              </div>

              {/* 4. Rate Limit Blocks */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldAlert className="w-5 h-5 text-warning" />
                  <h3 className="text-sm font-semibold">Rate Limit Blocks</h3>
                </div>
                <p className="text-2xl font-bold mb-1">{metrics.rateLimiter.totalBlocked}</p>
                <p className="text-[10px] text-text-secondary">Blocked in last 60 seconds</p>
              </div>

              {/* 5. Idempotency Cache Hit Rate */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-teal-400" />
                  <h3 className="text-sm font-semibold">Idempotency Cache</h3>
                </div>
                <p className="text-2xl font-bold mb-2">{metrics.idempotency.cacheHitRate}%</p>
                <div className="w-full bg-navy-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.idempotency.cacheHitRate}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-text-secondary">
                  <span>Hits: {metrics.idempotency.hits}</span>
                  <span>Misses: {metrics.idempotency.misses}</span>
                </div>
              </div>

              {/* 6. AI Assistant */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-teal-400" />
                  <h3 className="text-sm font-semibold">AI Assistant</h3>
                </div>
                <p className={`text-2xl font-bold mb-1 ${aiColor(metrics.aiAssistant.avgResponseTimeMs)}`}>
                  {metrics.aiAssistant.avgResponseTimeMs}ms
                </p>
                <div className="flex justify-between text-[10px] text-text-secondary">
                  <span>Queries: {metrics.aiAssistant.totalQueries}</span>
                  <span>Errors: {metrics.aiAssistant.errors}</span>
                </div>
              </div>
            </div>

            {/* Message Queue Card */}
            <div className="card p-5 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-semibold">Message Queue</h3>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-text-secondary mb-1">Published</p>
                  <p className="text-xl font-bold text-teal-400">{metrics.queueStats.published}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1">Consumed</p>
                  <p className="text-xl font-bold text-success">{metrics.queueStats.consumed}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1">Dead-Lettered</p>
                  <p className="text-xl font-bold text-error">{metrics.queueStats.deadLettered}</p>
                </div>
              </div>
              {/* Simple bar visualization */}
              <div className="flex gap-1 mt-3 h-8 items-end">
                {metrics.queueStats.published > 0 && (
                  <div
                    className="flex-1 bg-teal-500/30 rounded-t"
                    style={{
                      height: `${Math.min(
                        (metrics.queueStats.published / Math.max(metrics.queueStats.published, 1)) * 100,
                        100
                      )}%`,
                    }}
                    title={`Published: ${metrics.queueStats.published}`}
                  />
                )}
                {metrics.queueStats.consumed > 0 && (
                  <div
                    className="flex-1 bg-success/30 rounded-t"
                    style={{
                      height: `${Math.min(
                        (metrics.queueStats.consumed / Math.max(metrics.queueStats.published, 1)) * 100,
                        100
                      )}%`,
                    }}
                    title={`Consumed: ${metrics.queueStats.consumed}`}
                  />
                )}
                {metrics.queueStats.deadLettered > 0 && (
                  <div
                    className="flex-1 bg-error/30 rounded-t"
                    style={{
                      height: `${Math.min(
                        (metrics.queueStats.deadLettered / Math.max(metrics.queueStats.published, 1)) * 100,
                        100
                      )}%`,
                    }}
                    title={`Dead-lettered: ${metrics.queueStats.deadLettered}`}
                  />
                )}
              </div>
            </div>

            {/* Request Throughput Chart */}
            <div className="card p-5 mb-8">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-semibold">Requests per Second (Last 60s)</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.requestHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fill: '#8FA3B1', fontSize: 10 }}
                      tickFormatter={(ts) => new Date(ts).toLocaleTimeString('en-IN', { minute: '2-digit', second: '2-digit' })}
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <YAxis
                      tick={{ fill: '#8FA3B1', fontSize: 10 }}
                      stroke="rgba(255,255,255,0.1)"
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#162236',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: '#8FA3B1' }}
                      labelFormatter={(ts) => new Date(ts as number).toLocaleString('en-IN')}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', color: '#8FA3B1' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="search"
                      stroke="#00C2A8"
                      strokeWidth={2}
                      dot={false}
                      name="search"
                    />
                    <Line
                      type="monotone"
                      dataKey="seats"
                      stroke="#22C55E"
                      strokeWidth={2}
                      dot={false}
                      name="hold"
                    />
                    <Line
                      type="monotone"
                      dataKey="bookings"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={false}
                      name="confirm"
                    />
                    <Line
                      type="monotone"
                      dataKey="payments"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={false}
                      name="payment"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Two-column layout: Rate Limit Blocks + Concurrency Events */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Rate Limit Blocks Table */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <ShieldAlert className="w-4 h-4 text-warning" />
                  Recent Rate Limit Blocks
                </h3>
                {metrics.rateLimiter.recentBlocks.length === 0 ? (
                  <p className="text-sm text-text-secondary py-4 text-center">
                    No rate limit blocks recorded
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left p-2 text-text-secondary font-medium">Time</th>
                          <th className="text-left p-2 text-text-secondary font-medium">User</th>
                          <th className="text-left p-2 text-text-secondary font-medium">Endpoint</th>
                          <th className="text-right p-2 text-text-secondary font-medium">Retry-After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.rateLimiter.recentBlocks.map((block, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="p-2 font-mono">{formatTime(block.timestamp)}</td>
                            <td className="p-2 truncate max-w-[100px]">{block.email || 'Unknown'}</td>
                            <td className="p-2 font-mono text-[10px]">{block.endpoint}</td>
                            <td className="p-2 text-right text-warning">{block.retryAfter}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Concurrency Events Timeline */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-teal-400" />
                  Concurrency Events Timeline
                </h3>
                {metrics.concurrencyEvents.length === 0 ? (
                  <p className="text-sm text-text-secondary py-4 text-center">
                    No concurrency events recorded yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {metrics.concurrencyEvents.map((event, i) => {
                      const eventType = event.type || 'unknown';
                      const badgeColor =
                        eventType.includes('lock') || eventType.includes('conflict')
                          ? 'bg-error/10 text-error border border-error/20'
                          : eventType.includes('hit') || eventType.includes('success')
                          ? 'bg-success/10 text-success border border-success/20'
                          : eventType.includes('wait') || eventType.includes('expired')
                          ? 'bg-warning/10 text-warning border border-warning/20'
                          : 'bg-teal-500/10 text-teal-400 border border-teal-500/20';

                      return (
                        <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${badgeColor}`}>
                            {eventType.replace(/\./g, ' ')}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-text-secondary truncate">
                              {typeof event.details === 'string'
                                ? event.details
                                : JSON.stringify(event.details).slice(0, 80)}
                            </p>
                          </div>
                          <span className="text-[10px] text-text-secondary font-mono flex-shrink-0">
                            {formatTime(event.timestamp)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
