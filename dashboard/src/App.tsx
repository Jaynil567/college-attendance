import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar, TabType } from './components/Sidebar.js';
import { Login } from './pages/Login.js';
import { DashboardOverview } from './pages/DashboardOverview.js';
import { Classes } from './pages/Classes.js';
import { Students } from './pages/Students.js';
import { Teachers } from './pages/Teachers.js';
import { Reports } from './pages/Reports.js';
import { ApiService } from './services/api.js';
import { ClassItem } from './types/index.js';

export const AppContent: React.FC = () => {
  const { user, token, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('overview');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      setCurrentTab('students');
    }
  }, [user]);

  // Shared state
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    todayAttendanceRate: 92,
  });

  // Modal triggers from overview
  const [initialStudentModal, setInitialStudentModal] = useState(false);

  const loadData = async () => {
    if (!token) return;
    try {
      const [classesRes, studentsRes, reportRes] = await Promise.all([
        ApiService.getClasses(),
        ApiService.getStudents(),
        ApiService.getAttendanceReport({ status: 'present' }),
      ]);

      if (classesRes.data.success) setClasses(classesRes.data.classes || []);

      const studentCount = studentsRes.data.success ? studentsRes.data.count || 0 : 0;
      const records = reportRes.data.success ? reportRes.data.records || [] : [];
      const presentCount = records.length;
      const realAttendanceRate = studentCount > 0 ? Math.min(100, Math.round((presentCount / studentCount) * 100)) : 0;

      setStats({
        totalStudents: studentCount,
        totalClasses: classesRes.data.classes?.length || 0,
        todayAttendanceRate: realAttendanceRate,
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
      <Navbar activeSessionCount={0} />

      <div className="flex flex-1">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          activeSessionCount={0}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {currentTab === 'overview' && (
            <DashboardOverview
              stats={stats}
              setCurrentTab={setCurrentTab}
              openAddStudentModal={() => {
                setInitialStudentModal(true);
                setCurrentTab('students');
              }}
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
