import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bus, User, LogOut, Ticket, LayoutDashboard, Briefcase } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-navy/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <Bus className="w-8 h-8 text-teal-500 group-hover:scale-110 transition-transform" />
            <span className="text-xl font-bold text-gradient">RapidRoute</span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors ${
                isActive('/') ? 'text-teal-400' : 'text-text-secondary hover:text-white'
              }`}
            >
              Home
            </Link>

            {isAuthenticated() && (
              <>
                <Link
                  to="/my-bookings"
                  className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                    isActive('/my-bookings')
                      ? 'text-teal-400'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  <Ticket className="w-4 h-4" />
                  My Bookings
                </Link>

                {/* Operator link — visible to operators AND admin */}
                {(user?.role === 'operator' || user?.role === 'admin') && (
                  <Link
                    to="/operator"
                    className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                      isActive('/operator')
                        ? 'text-teal-400'
                        : 'text-text-secondary hover:text-white'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    Operator
                  </Link>
                )}

                {/* Admin link — visible to admin only */}
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                      isActive('/admin')
                        ? 'text-teal-400'
                        : 'text-text-secondary hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Admin
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Auth */}
          <div className="flex items-center gap-4">
            {isAuthenticated() ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-teal-400" />
                  </div>
                  <span className="text-sm text-text-secondary">{user?.name}</span>
                {user?.role !== 'customer' && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    {user?.role}
                  </span>
                )}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-sm text-text-secondary hover:text-error transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-sm font-medium text-text-secondary hover:text-white transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm px-4 py-2"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
