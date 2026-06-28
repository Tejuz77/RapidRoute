import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Search, ArrowLeftRight, Calendar, MapPin, Star, ArrowRight, Clock, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

interface City {
  id: number;
  name: string;
  state: string;
}

const POPULAR_ROUTES = [
  { from: 'Mumbai', to: 'Pune', icon: '🏙️' },
  { from: 'Delhi', to: 'Jaipur', icon: '🏛️' },
  { from: 'Bangalore', to: 'Chennai', icon: '🌴' },
  { from: 'Hyderabad', to: 'Chennai', icon: '🌆' },
];

export default function Home() {
  const [cities, setCities] = useState<City[]>([]);
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [date, setDate] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const response = await api.get('/api/search/cities');
        setCities(response.data.cities);
      } catch (error) {
        console.error('Failed to fetch cities:', error);
      }
    };
    fetchCities();
  }, []);

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  const handleSwap = () => {
    setFromCity(toCity);
    setToCity(fromCity);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromCity || !toCity || !date) {
      toast.error('Please select origin, destination, and date');
      return;
    }
    if (fromCity === toCity) {
      toast.error('Origin and destination cannot be the same');
      return;
    }
    navigate(`/search?from=${fromCity}&to=${toCity}&date=${date}`);
  };

  const handlePopularRoute = (from: string, to: string) => {
    const fromCityObj = cities.find((c) => c.name === from);
    const toCityObj = cities.find((c) => c.name === to);
    if (fromCityObj && toCityObj) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      navigate(`/search?from=${fromCityObj.id}&to=${toCityObj.id}&date=${dateStr}`);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-teal-500/3 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4 leading-tight">
              Travel Smarter with{' '}
              <span className="text-gradient">RapidRoute</span>
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto">
              Book intercity bus tickets with confidence. Real-time seat availability,
              secure payments, and instant confirmation.
            </p>
          </div>

          {/* Search Form */}
          <div className="max-w-4xl mx-auto">
            <div className="card p-6 sm:p-8">
              <form onSubmit={handleSearch}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* From City */}
                  <div className="relative">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      From
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-teal-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={fromCity}
                        onChange={(e) => setFromCity(e.target.value)}
                        className="select-field pl-9 text-sm"
                      >
                        <option value="">Select city</option>
                        {cities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.name}, {city.state}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="flex items-end justify-center sm:justify-start">
                    <button
                      type="button"
                      onClick={handleSwap}
                      className="p-2 rounded-full bg-navy-900 border border-white/10 hover:border-teal-400/50 hover:bg-teal-500/10 transition-all duration-200 group"
                      title="Swap cities"
                    >
                      <ArrowLeftRight className="w-4 h-4 text-text-secondary group-hover:text-teal-400 transition-colors" />
                    </button>
                  </div>

                  {/* To City */}
                  <div className="relative">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      To
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-error absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={toCity}
                        onChange={(e) => setToCity(e.target.value)}
                        className="select-field pl-9 text-sm"
                      >
                        <option value="">Select city</option>
                        {cities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.name}, {city.state}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="relative">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      Travel Date
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="input-field pl-9 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full mt-6 flex items-center justify-center gap-2">
                  <Search className="w-5 h-5" />
                  Search Buses
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Real-Time Seats</h3>
              <p className="text-text-secondary text-sm">
                Live seat availability with automatic updates every 5 seconds
              </p>
            </div>

            <div className="card p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center mx-auto mb-4">
                <IndianRupee className="w-6 h-6 text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Best Prices</h3>
              <p className="text-text-secondary text-sm">
                Competitive fares with no hidden charges on all routes
              </p>
            </div>

            <div className="card p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center mx-auto mb-4">
                <Star className="w-6 h-6 text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Safe Booking</h3>
              <p className="text-text-secondary text-sm">
                Secure payments with idempotency guarantees — never double charged
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Routes */}
      <section className="py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Popular Routes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {POPULAR_ROUTES.map((route) => (
              <button
                key={`${route.from}-${route.to}`}
                onClick={() => handlePopularRoute(route.from, route.to)}
                className="card p-6 text-left group hover:border-teal-400/30 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">{route.icon}</span>
                  <ArrowRight className="w-5 h-5 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{route.from}</span>
                  <span className="text-text-secondary">→</span>
                  <span className="font-medium">{route.to}</span>
                </div>
                <p className="text-xs text-text-secondary mt-2">
                  View available buses →
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
