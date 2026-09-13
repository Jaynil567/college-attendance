import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { LogOut, Shield, User, Radio } from 'lucide-react';

export const Navbar: React.FC<{ activeSessionCount: number }> = ({ activeSessionCount }) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md shadow-blue-500/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-800 leading-tight">Classroom BLE Attendance</h1>
            <p className="text-xs text-slate-500">Hardware-Cryptographic Presence Verification</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Active Session Indicator */}
          {activeSessionCount > 0 ? (
            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>{activeSessionCount} Active Session Live</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center space-x-1.5 bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              <span>No Active Session</span>
            </div>
          )}

          {/* User Profile Pill */}
          <div className="flex items-center space-x-3 pl-2 border-l border-slate-200">
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

            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-sm">
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
