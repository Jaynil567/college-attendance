import React from 'react';
import { StatCard } from '../components/StatCard.js';
import { Users, BookOpen, CheckCircle2, ArrowUpRight, UserPlus, FileSpreadsheet } from 'lucide-react';
import { TabType } from '../components/Sidebar.js';

interface DashboardOverviewProps {
  stats: {
    totalStudents: number;
    totalClasses: number;
    todayAttendanceRate: number;
  };
  setCurrentTab: (tab: TabType) => void;
  openAddStudentModal: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  setCurrentTab,
  openAddStudentModal,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-900/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold text-blue-100 border border-white/20">
            College Attendance Management
          </span>
          <h2 className="text-2xl md:text-3xl font-black mt-2">Attendance Command Center</h2>
          <p className="text-blue-100 text-sm mt-1 max-w-xl">
            Student directory, password management, and attendance reports portal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={openAddStudentModal}
            className="px-5 py-3 bg-white text-blue-700 hover:bg-blue-50 active:bg-blue-100 font-bold text-sm rounded-xl shadow-lg flex items-center space-x-2 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          title="Average Attendance Rate"
          value={`${stats.todayAttendanceRate}%`}
          subtitle="Overall attendance percentage"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => setCurrentTab('students')}
          className="cursor-pointer bg-white p-6 border border-slate-200 rounded-2xl hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-105 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
          </div>
          <h4 className="font-bold text-slate-900 text-lg mt-4">Student Registry & Passwords</h4>
          <p className="text-xs text-slate-500 mt-1">
            Search by enrollment number, assign classes, reset passwords, and download credentials Excel sheet.
          </p>
        </div>

        <div
          onClick={() => setCurrentTab('reports')}
          className="cursor-pointer bg-white p-6 border border-slate-200 rounded-2xl hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" />
          </div>
          <h4 className="font-bold text-slate-900 text-lg mt-4">Export Attendance (.XLSX)</h4>
          <p className="text-xs text-slate-500 mt-1">
            Generate and download formatted Excel attendance sheets filtered by date, subject, and class.
          </p>
        </div>
      </div>
    </div>
  );
};
