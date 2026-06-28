import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Zap, X, Code, FileCode } from 'lucide-react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import SeatSelection from './pages/SeatSelection';
import Checkout from './pages/Checkout';
import Confirmation from './pages/Confirmation';
import MyBookings from './pages/MyBookings';
import Admin from './pages/Admin';
import OperatorDashboard from './pages/OperatorDashboard';
import Performance from './pages/Performance';
import AIAssistant from './components/AIAssistant';
import Login from './pages/Login';
import Register from './pages/Register';

interface ConcurrencyPattern {
  id: number;
  name: string;
  file: string;
  description: string;
  snippet: string;
}

export default function App() {
  const [showDemo, setShowDemo] = useState(false);
  const [patterns, setPatterns] = useState<ConcurrencyPattern[]>([]);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (showDemo) {
      fetch('/api/concurrency-patterns')
        .then((res) => res.json())
        .then((data) => setPatterns(data.patterns))
        .catch(() => {});
    }
  }, [showDemo]);

  return (
    <Router>
      <div className="min-h-screen bg-navy">
        <Navbar />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#162236',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
            },
            success: {
              iconTheme: { primary: '#22C55E', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#fff' },
            },
          }}
        />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/seats/:routeId" element={<SeatSelection />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/confirmation/:bookingId" element={<Confirmation />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/operator" element={<OperatorDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>

        {/* AI Smart Assistant — floating chat widget */}
        <AIAssistant />

        {/* Concurrency Demo Button (only in dev mode) */}
        {isDev && (
          <>
            <button
              onClick={() => setShowDemo(true)}
              className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-teal-500 hover:bg-teal-400 shadow-lg shadow-teal-500/30 flex items-center justify-center transition-all duration-200 hover:scale-110 group"
              title="Concurrency Demo"
            >
              <Zap className="w-6 h-6 text-white" />
            </button>

            {/* Concurrency Demo Modal */}
            {showDemo && (
              <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDemo(false)} />
                <div className="relative bg-navy-900 rounded-2xl border border-white/10 max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 animate-slide-up">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Zap className="w-6 h-6 text-teal-400" />
                      <h2 className="text-xl font-bold">Concurrency Patterns</h2>
                    </div>
                    <button
                      onClick={() => setShowDemo(false)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <X className="w-5 h-5 text-text-secondary" />
                    </button>
                  </div>

                  <p className="text-sm text-text-secondary mb-6">
                    RapidRoute demonstrates 7 advanced concurrency and synchronization patterns
                    that ensure data consistency, prevent race conditions, and handle failures gracefully.
                  </p>

                  <div className="space-y-4">
                    {patterns.map((pattern, index) => (
                      <div key={pattern.id} className="card p-5 hover:border-teal-400/30 transition-all">
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-teal-400">{index + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">{pattern.name}</h3>
                            <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                              <FileCode className="w-3 h-3" />
                              {pattern.file}
                            </p>
                            <p className="text-xs text-text-secondary mt-2">
                              {pattern.description}
                            </p>
                            <div className="mt-3 bg-navy rounded-lg p-3 overflow-x-auto">
                              <code className="text-xs text-teal-400 font-mono whitespace-pre-wrap break-all">
                                {pattern.snippet}
                              </code>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Router>
  );
}
