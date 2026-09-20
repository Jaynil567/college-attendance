import React from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export type TabType = 'overview' | 'classes' | 'students' | 'teachers' | 'reports';

interface SidebarProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  activeSessionCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const menuItems = isAdmin
    ? [
        { id: 'overview' as TabType, label: 'Overview', icon: LayoutDashboard },
        { id: 'students' as TabType, label: 'Student Directory & Passwords', icon: Users },
        { id: 'teachers' as TabType, label: 'Faculty & Teachers', icon: GraduationCap },
        { id: 'reports' as TabType, label: 'Attendance Records & Excel', icon: FileSpreadsheet },
      ]
    : [
        { id: 'students' as TabType, label: 'Student Directory', icon: Users },
        { id: 'reports' as TabType, label: 'Attendance Records & Excel', icon: FileSpreadsheet },
      ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-61px)] p-4 flex flex-col justify-between">
      <div className="space-y-1">
        <div className="px-3 mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {isAdmin ? 'Admin Console' : 'Faculty Portal'}
          </p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
            {user?.role || 'Staff'}
          </span>
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center space-x-2 text-slate-700 font-semibold text-xs mb-1">
          <span>College Attendance System</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">
          Management Console & Student Credentials Portal.
        </p>
      </div>
    </aside>
  );
};
