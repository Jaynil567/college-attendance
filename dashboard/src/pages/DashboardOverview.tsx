import React from 'react';
import { StatCard } from '../components/StatCard.js';
import { Users, BookOpen, Cpu, CheckCircle2, Radio, ArrowUpRight, Play, UserPlus, FileSpreadsheet } from 'lucide-react';
import { TabType } from '../components/Sidebar.js';

interface DashboardOverviewProps {
  stats: {
    totalStudents: number;
    totalClasses: number;
    totalDevices: number;
    todayAttendanceRate: number;
  };
  activeSessions: any[];
  setCurrentTab: (tab: TabType) => void;
  openStartSessionModal: () => void;
  openAddStudentModal: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  activeSessions,
  setCurrentTab,
  openStartSessionModal,
  openAddStudentModal,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-900/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold text-blue-100 border border-white/20">
            Smart Classroom Presence
          </span>
          <h2 className="text-2xl md:text-3xl font-black mt-2">Attendance Command Center</h2>
          <p className="text-blue-100 text-sm mt-1 max-w-xl">
            Cryptographic ESP32 BLE verification system actively securing attendance across 200+ concurrent classroom seats.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={openStartSessionModal}
            className="px-5 py-3 bg-white text-blue-700 hover:bg-blue-50 active:bg-blue-100 font-bold text-sm rounded-xl shadow-lg flex items-center space-x-2 transition-all"
          >
            <Play className="w-4 h-4 fill-blue-700" />
            <span>Start Session</span>
          </button>
          <button
            onClick={openAddStudentModal}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm rounded-xl flex items-center space-x-2 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Registered Students"
          value={stats.totalStudents}
          subtitle="Enrolled across active classes"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Active Classes / Subjects"
          value={stats.totalClasses}
          subtitle="Departments & divisions"
          icon={BookOpen}
          color="purple"
        />
        <StatCard
          title="Classroom ESP32 Nodes"
          value={stats.totalDevices}
          subtitle="Hardware BLE beacons online"
          icon={Cpu}
          color="amber"
        />
        <StatCard
          title="Average Attendance Rate"
          value={`${stats.todayAttendanceRate}%`}
          subtitle="Cryptographically verified"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Active Sessions Live Monitor */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">Live Classroom Attendance Sessions</h3>
              <p className="text-xs text-slate-400">Real-time attendance windows currently accepting BLE student check-ins</p>
            </div>
          </div>
          <button
            onClick={() => setCurrentTab('live')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
          >
            <span>Live Monitor</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeSessions.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
            <p className="text-sm font-semibold text-slate-600">No active attendance sessions right now.</p>
            <p className="text-xs text-slate-400 mt-1">Start an attendance window when class begins.</p>
            <button
              onClick={openStartSessionModal}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Start New Session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setCurrentTab('live')}
                className="cursor-pointer p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl hover:border-emerald-400 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-md uppercase">
                      Active Window
                    </span>
                    <h4 className="font-bold text-slate-900 mt-1">{session.session_name}</h4>
                    <p className="text-xs text-slate-600">
                      {session.class_name} • {session.subject} (Sem {session.semester}-{session.division})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-emerald-700">{session.present_count || 0}</span>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Students Checked-in</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-emerald-100 flex items-center justify-between text-xs text-slate-500">
                  <span>ESP32: <strong>{session.device_esp32_id || session.esp32_id}</strong> ({session.classroom_id || 'Room'})</span>
                  <span className="text-emerald-700 font-semibold">Ends at {new Date(session.end_time).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setCurrentTab('students')}
          className="cursor-pointer bg-white p-5 border border-slate-200 rounded-2xl hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
          </div>
          <h4 className="font-bold text-slate-900 mt-3">Student Registry</h4>
          <p className="text-xs text-slate-500 mt-1">
            Search by enrollment number, assign classes, and manage active status.
          </p>
        </div>

        <div
          onClick={() => setCurrentTab('devices')}
          className="cursor-pointer bg-white p-5 border border-slate-200 rounded-2xl hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-105 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
          </div>
          <h4 className="font-bold text-slate-900 mt-3">ESP32 Hardware Provisioning</h4>
          <p className="text-xs text-slate-500 mt-1">
            Register hardware nodes, generate 256-bit cryptographic keys, and view status.
          </p>
        </div>

        <div
          onClick={() => setCurrentTab('reports')}
          className="cursor-pointer bg-white p-5 border border-slate-200 rounded-2xl hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
          </div>
          <h4 className="font-bold text-slate-900 mt-3">Export Attendance (.XLSX)</h4>
          <p className="text-xs text-slate-500 mt-1">
            Generate and download formatted Excel attendance sheets filtered by date and class.
          </p>
        </div>
      </div>
    </div>
  );
};
