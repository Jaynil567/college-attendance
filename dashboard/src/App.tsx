import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar, TabType } from './components/Sidebar.js';
import { Login } from './pages/Login.js';
import { DashboardOverview } from './pages/DashboardOverview.js';
import { LiveSession } from './pages/LiveSession.js';
import { Classes } from './pages/Classes.js';
import { Students } from './pages/Students.js';
import { Devices } from './pages/Devices.js';
import { Teachers } from './pages/Teachers.js';
import { Reports } from './pages/Reports.js';
import { ApiService } from './services/api.js';
import { ClassItem, ESP32Device } from './types/index.js';

export const AppContent: React.FC = () => {
  const { user, token, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('overview');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      setCurrentTab('live');
    }
  }, [user]);

  // Shared state
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [devices, setDevices] = useState<ESP32Device[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalDevices: 0,
    todayAttendanceRate: 88,
  });

  // Modal triggers from overview
  const [initialStudentModal, setInitialStudentModal] = useState(false);

  const loadData = async () => {
    if (!token) return;
    try {
      const [classesRes, devicesRes, sessionsRes, studentsRes] = await Promise.all([
        ApiService.getClasses(),
        ApiService.getDevices(),
        ApiService.getActiveSessions(),
        ApiService.getStudents(),
      ]);

      if (classesRes.data.success) setClasses(classesRes.data.classes || []);
      if (devicesRes.data.success) setDevices(devicesRes.data.devices || []);
      if (sessionsRes.data.success) setActiveSessions(sessionsRes.data.sessions || []);

      const studentCount = studentsRes.data.success ? studentsRes.data.count || 0 : 0;
      setStats({
        totalStudents: studentCount,
        totalClasses: classesRes.data.classes?.length || 0,
        totalDevices: devicesRes.data.devices?.length || 0,
        todayAttendanceRate: 92,
      });
    } catch (err) {
      console.error('Error fetching dashboard data', err);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
      const interval = setInterval(loadData, 10000); // 10s background sync
      return () => clearInterval(interval);
    }
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-500">Connecting to Attendance System...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar activeSessionCount={activeSessions.length} />

      <div className="flex flex-1">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          activeSessionCount={activeSessions.length}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {currentTab === 'overview' && (
            <DashboardOverview
              stats={stats}
              activeSessions={activeSessions}
              setCurrentTab={setCurrentTab}
              openStartSessionModal={() => setCurrentTab('live')}
              openAddStudentModal={() => {
                setInitialStudentModal(true);
                setCurrentTab('students');
              }}
            />
          )}

          {currentTab === 'live' && (
            <LiveSession
              classes={classes}
              devices={devices}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'classes' && (
            <Classes
              classes={classes}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'students' && (
            <Students
              classes={classes}
              onRefresh={loadData}
              initialAddModalOpen={initialStudentModal}
            />
          )}

          {currentTab === 'devices' && (
            <Devices
              devices={devices}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'teachers' && (
            <Teachers onRefresh={loadData} />
          )}

          {currentTab === 'reports' && (
            <Reports classes={classes} />
          )}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};

export default App;
