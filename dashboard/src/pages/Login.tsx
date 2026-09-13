import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { ApiService } from '../services/api.js';
import { Radio, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('teacher@college.edu');
  const [password, setPassword] = useState('Teacher@123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await ApiService.teacherLogin({ email, password });
      if (res.data.success && res.data.token) {
        login(res.data.token, res.data.user);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (role: 'teacher' | 'admin') => {
    if (role === 'teacher') {
      setEmail('teacher@college.edu');
      setPassword('Teacher@123');
    } else {
      setEmail('admin@college.edu');
      setPassword('Admin@123');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-8 text-white text-center">
          <div className="inline-flex p-3.5 bg-white/10 backdrop-blur-md rounded-2xl mb-4 border border-white/20 shadow-inner">
            <Radio className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Classroom BLE Attendance</h2>
          <p className="text-blue-100 text-sm mt-1">Teacher & Administrator Control Center</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start space-x-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@college.edu"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Quick Demo Credentials Switcher */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-semibold mb-2.5 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Quick Login (Demo Accounts):</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials('teacher')}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 text-left"
              >
                <span className="block font-bold text-blue-700">Teacher Account</span>
                <span className="text-[11px] text-slate-500">teacher@college.edu</span>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('admin')}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 text-left"
              >
                <span className="block font-bold text-purple-700">Admin Account</span>
                <span className="text-[11px] text-slate-500">admin@college.edu</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
