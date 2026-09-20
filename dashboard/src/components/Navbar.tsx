import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { LogOut, GraduationCap, Menu, X } from 'lucide-react';

interface NavbarProps {
  activeSessionCount?: number;
  toggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ toggleMobileMenu, isMobileMenuOpen }) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          {/* Mobile Menu Hamburger Button */}
          <button
            onClick={toggleMobileMenu}
            className="p-2 md:hidden text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md shadow-blue-500/20">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base md:text-lg text-slate-800 leading-tight">College Attendance</h1>
            <p className="text-[11px] md:text-xs text-slate-500 hidden sm:block">Student & Faculty Administration Console</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          {/* User Profile Pill */}
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-slate-800">{user?.fullName || (user as any)?.full_name || 'Staff'}</p>
              <div className="flex items-center justify-end space-x-1">
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  user?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {user?.role || 'User'}
                </span>
                <span className="text-xs text-slate-400">{user?.department || 'College Faculty'}</span>
              </div>
            </div>

            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs md:text-sm">
              {(user?.fullName || (user as any)?.full_name || 'U').charAt(0).toUpperCase()}
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
