import React from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export type TabType = 'overview' | 'classes' | 'students' | 'teachers' | 'reports';

interface SidebarProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  isMobileOpen?: boolean;
  closeMobileMenu?: () => void;
  activeSessionCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, isMobileOpen, closeMobileMenu }) => {
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

  const handleTabSelect = (tab: TabType) => {
    setCurrentTab(tab);
    if (closeMobileMenu) {
      closeMobileMenu();
    }
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full p-4">
      <div className="space-y-1">
        <div className="px-3 mb-3 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {isAdmin ? 'Admin Console' : 'Faculty Portal'}
          </p>
          <div className="flex items-center space-x-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
              {user?.role || 'Staff'}
            </span>
            {closeMobileMenu && (
              <button
                onClick={closeMobileMenu}
                className="p-1 md:hidden text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabSelect(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 md:py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md md:bg-blue-50 md:text-blue-700 md:shadow-sm md:border md:border-blue-100 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white md:text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mt-6">
        <div className="flex items-center space-x-2 text-slate-700 font-semibold text-xs mb-1">
          <span>College Attendance System</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">
          Management Console & Student Credentials Portal.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-61px)] flex-col justify-between shrink-0">
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={closeMobileMenu}
          />
          {/* Mobile Sidebar Content */}
          <aside className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl z-10 overflow-y-auto">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};
