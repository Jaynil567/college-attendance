import React from 'react';
import {
  LayoutDashboard,
  Radio,
  BookOpen,
  Users,
  Cpu,
  FileSpreadsheet,
} from 'lucide-react';

export type TabType = 'overview' | 'live' | 'classes' | 'students' | 'devices' | 'reports';

interface SidebarProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  activeSessionCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, activeSessionCount }) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'live',
      label: 'Live Session',
      icon: Radio,
      badge: activeSessionCount > 0 ? `${activeSessionCount}` : null,
    },
    { id: 'classes', label: 'Classes & Subjects', icon: BookOpen },
    { id: 'students', label: 'Student Directory', icon: Users },
    { id: 'devices', label: 'ESP32 Hardware Nodes', icon: Cpu },
    { id: 'reports', label: 'Attendance & Export', icon: FileSpreadsheet },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-61px)] p-4 flex flex-col justify-between">
      <div className="space-y-1">
        <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Management
        </p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id as TabType)}
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
              {item.badge && (
                <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center space-x-2 text-slate-700 font-semibold text-xs mb-1">
          <Cpu className="w-3.5 h-3.5 text-blue-600" />
          <span>BLE Hardware Security</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">
          Cryptographic HMAC-SHA256 & replay defense active for all classroom nodes.
        </p>
      </div>
    </aside>
  );
};
