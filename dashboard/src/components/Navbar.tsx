import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { LogOut, GraduationCap } from 'lucide-react';

export const Navbar: React.FC<{ activeSessionCount?: number }> = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md shadow-blue-500/20">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-800 leading-tight">College Attendance System</h1>
            <p className="text-xs text-slate-500">Student & Faculty Administration Console</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* User Profile Pill */}
          <div className="flex items-center space-x-3 pl-2">
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
