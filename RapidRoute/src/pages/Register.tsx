import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bus, User, Mail, Lock, Phone, Eye, EyeOff, ShieldCheck, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'operator'>('customer');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { login } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/register', { name, email, password, phone, role });
      const { user, token } = response.data;
      login(user, token);
      toast.success(`Welcome to RapidRoute, ${user.name}!`);
      if (role === 'operator') {
        navigate('/operator');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="card p-8 animate-fade-in">
          {/* Header */}
          <div className="text-center mb-8">
            <Bus className="w-12 h-12 text-teal-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold">Create Account</h1>
            <p className="text-text-secondary mt-2">Join RapidRoute today</p>
          </div>

          {/* Role Toggle */}
          <div className="flex rounded-xl bg-navy-900 p-1 mb-6 border border-white/10">
            <button
              type="button"
              onClick={() => setRole('customer')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
                role === 'customer'
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 shadow-sm'
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              Customer
            </button>
            <button
              type="button"
              onClick={() => setRole('operator')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
                role === 'operator'
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 shadow-sm'
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Bus Operator
            </button>
          </div>

          {role === 'operator' && (
            <div className="flex items-start gap-3 bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 mb-6">
              <ShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-teal-400">Bus Operator Account</p>
                <p className="text-xs text-text-secondary mt-1">
                  Register and manage your own buses, create routes, set fares, and view bookings.
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91-9876543210"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner !w-5 !h-5" />
                  Creating account...
                </span>
              ) : role === 'operator' ? (
                'Register as Operator'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="text-center text-text-secondary mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-400 hover:text-teal-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
