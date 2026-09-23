import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { MobileAuthProvider, useMobileAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { MarkAttendanceScreen } from './src/screens/MarkAttendanceScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { TeacherSessionScreen } from './src/screens/TeacherSessionScreen';
import { TeacherStudentsScreen } from './src/screens/TeacherStudentsScreen';
import { TeacherReportsScreen } from './src/screens/TeacherReportsScreen';
import { TeacherOverviewScreen } from './src/screens/TeacherOverviewScreen';

type StudentTab = 'mark' | 'history' | 'profile';
type TeacherTab = 'session' | 'students' | 'reports' | 'overview';

const MainNavigator: React.FC = () => {
  const { role, student, teacher, token } = useMobileAuth();
  const [studentTab, setStudentTab] = useState<StudentTab>('mark');
  const [teacherTab, setTeacherTab] = useState<TeacherTab>('session');

  if (!token || (!student && !teacher)) {
    return <LoginScreen />;
  }

  if (role === 'teacher') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#064E3B" />

        {/* Screen Body for Teacher */}
        <View style={styles.screenContainer}>
          {teacherTab === 'session' && <TeacherSessionScreen />}
          {teacherTab === 'students' && <TeacherStudentsScreen />}
          {teacherTab === 'reports' && <TeacherReportsScreen />}
          {teacherTab === 'overview' && (
            <TeacherOverviewScreen onNavigateTab={(tab) => setTeacherTab(tab)} />
          )}
        </View>

        {/* Bottom Tab Bar for Teacher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, teacherTab === 'session' && styles.tabItemActive]}
            onPress={() => setTeacherTab('session')}
          >
            <Text style={styles.tabEmoji}>📡</Text>
            <Text style={[styles.tabLabel, teacherTab === 'session' && styles.tabLabelActive]}>
              Live Beacon
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, teacherTab === 'students' && styles.tabItemActive]}
            onPress={() => setTeacherTab('students')}
          >
            <Text style={styles.tabEmoji}>👥</Text>
            <Text style={[styles.tabLabel, teacherTab === 'students' && styles.tabLabelActive]}>
              Students
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, teacherTab === 'reports' && styles.tabItemActive]}
            onPress={() => setTeacherTab('reports')}
          >
            <Text style={styles.tabEmoji}>📜</Text>
            <Text style={[styles.tabLabel, teacherTab === 'reports' && styles.tabLabelActive]}>
              Ledger
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, teacherTab === 'overview' && styles.tabItemActive]}
            onPress={() => setTeacherTab('overview')}
          >
            <Text style={styles.tabEmoji}>📊</Text>
            <Text style={[styles.tabLabel, teacherTab === 'overview' && styles.tabLabelActive]}>
              Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.appLogo}>CAMPUS ATTENDANCE</Text>
          <Text style={styles.appSub}>BLE Presence Verification</Text>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.pulseDot} />
          <Text style={styles.onlineText}>BLE Active</Text>
        </View>
      </View>

      {/* Screen Body */}
      <View style={styles.screenContainer}>
        {studentTab === 'mark' && <MarkAttendanceScreen />}
        {studentTab === 'history' && <HistoryScreen />}
        {studentTab === 'profile' && <ProfileScreen />}
      </View>

      {/* Bottom Navigation Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, studentTab === 'mark' && styles.tabItemActive]}
          onPress={() => setStudentTab('mark')}
        >
          <Text style={styles.tabEmoji}>📡</Text>
          <Text style={[styles.tabLabel, studentTab === 'mark' && styles.tabLabelActive]}>
            Mark Presence
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, studentTab === 'history' && styles.tabItemActive]}
          onPress={() => setStudentTab('history')}
        >
          <Text style={styles.tabEmoji}>📊</Text>
          <Text style={[styles.tabLabel, studentTab === 'history' && styles.tabLabelActive]}>
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, studentTab === 'profile' && styles.tabItemActive]}
          onPress={() => setStudentTab('profile')}
        >
          <Text style={styles.tabEmoji}>👤</Text>
          <Text style={[styles.tabLabel, studentTab === 'profile' && styles.tabLabelActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <MobileAuthProvider>
      <MainNavigator />
    </MobileAuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  appLogo: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E3A8A',
    letterSpacing: 0.5,
  },
  appSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingBottom: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    opacity: 1,
  },
  tabEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabLabelActive: {
    color: '#2563EB',
  },
});
