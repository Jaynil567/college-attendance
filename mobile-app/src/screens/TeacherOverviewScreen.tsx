import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useMobileAuth } from '../context/AuthContext';
import { MobileApiService } from '../services/api';

interface TeacherOverviewScreenProps {
  onNavigateTab: (tab: 'session' | 'students' | 'reports') => void;
}

export const TeacherOverviewScreen: React.FC<TeacherOverviewScreenProps> = ({ onNavigateTab }) => {
  const { teacher, logout } = useMobileAuth();
  const [loading, setLoading] = useState(true);
  const [auditoriums, setAuditoriums] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(1149);
  const [totalSessions, setTotalSessions] = useState<number>(0);

  const fetchOverviewData = async () => {
    try {
      const [audiRes, studRes, sessRes] = await Promise.all([
        MobileApiService.getAuditoriumsStatus(),
        MobileApiService.getStudents(),
        MobileApiService.getAllSessions(),
      ]);

      if (audiRes.data.success && audiRes.data.auditoriums) {
        setAuditoriums(audiRes.data.auditoriums);
      }

      if (studRes.data.success && studRes.data.students) {
        setTotalStudents(studRes.data.students.length);
      }

      if (sessRes.data.success && sessRes.data.sessions) {
        setTotalSessions(sessRes.data.sessions.length);
      }
    } catch (err) {
      console.warn('[TeacherOverview] fetchOverviewData error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading Dashboard Overview...</Text>
      </View>
    );
  }

  const liveCount = auditoriums.filter((a) => a.isLive).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchOverviewData} />}
    >
      {/* Faculty Profile Banner */}
      <View style={styles.facultyBanner}>
        <View style={styles.facultyLeft}>
          <Text style={styles.facultyBadge}>👨‍🏫 FACULTY DASHBOARD</Text>
          <Text style={styles.facultyName}>{teacher?.fullName || 'College Faculty'}</Text>
          <Text style={styles.facultyDept}>{teacher?.department || teacher?.email || 'General Engineering'}</Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Analytics Summary Grid */}
      <Text style={styles.sectionTitle}>📊 System Overview</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>👥</Text>
          <Text style={styles.statValue}>{totalStudents}</Text>
          <Text style={styles.statLabel}>Active Students</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>📡</Text>
          <Text style={styles.statValue}>{liveCount} / 3</Text>
          <Text style={styles.statLabel}>Auditoriums Live</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>📜</Text>
          <Text style={styles.statValue}>{totalSessions}</Text>
          <Text style={styles.statLabel}>Sessions Conducted</Text>
        </View>
      </View>

      {/* Live Auditorium Status */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🏛️ 3-Auditorium Status</Text>
      <View style={styles.audiContainer}>
        {auditoriums.map((audi) => {
          return (
            <View key={audi.id} style={styles.audiRow}>
              <View style={styles.audiLeft}>
                <Text style={styles.audiName}>{audi.name || audi.id}</Text>
                {audi.isLive && audi.activeSession ? (
                  <Text style={styles.audiSubject}>
                    Active: {audi.activeSession.sessionName || audi.activeSession.subject}
                  </Text>
                ) : (
                  <Text style={styles.audiVacant}>Available for lecture</Text>
                )}
              </View>

              <View style={[styles.statusBadge, audi.isLive ? styles.badgeLive : styles.badgeVacant]}>
                <Text style={[styles.statusBadgeText, audi.isLive ? styles.textLive : styles.textVacant]}>
                  {audi.isLive ? '🔴 IN USE' : '🟢 VACANT'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Quick Navigation Cards */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>⚡ Quick Actions</Text>

      <TouchableOpacity style={styles.actionCard} onPress={() => onNavigateTab('session')}>
        <Text style={styles.actionEmoji}>📡</Text>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>Start / Manage Attendance Beacon</Text>
          <Text style={styles.actionSub}>Broadcast BLE signal for Auditorium 1, 2, or 3</Text>
        </View>
        <Text style={styles.actionArrow}>➔</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} onPress={() => onNavigateTab('students')}>
        <Text style={styles.actionEmoji}>👥</Text>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>Student Directory & Device Bindings</Text>
          <Text style={styles.actionSub}>Reset student phone binding, export credentials Excel</Text>
        </View>
        <Text style={styles.actionArrow}>➔</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} onPress={() => onNavigateTab('reports')}>
        <Text style={styles.actionEmoji}>📜</Text>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>Past Session Ledger & Reports</Text>
          <Text style={styles.actionSub}>View past sessions, download Excel attendance sheets</Text>
        </View>
        <Text style={styles.actionArrow}>➔</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  facultyBanner: {
    backgroundColor: '#064E3B',
    padding: 18,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  facultyLeft: {
    flex: 1,
    paddingRight: 10,
  },
  facultyBadge: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  facultyName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  facultyDept: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  audiContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  audiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  audiLeft: {
    flex: 1,
  },
  audiName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  audiSubject: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 2,
  },
  audiVacant: {
    fontSize: 12,
    color: '#059669',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeLive: {
    backgroundColor: '#FEF2F2',
  },
  badgeVacant: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textLive: {
    color: '#DC2626',
  },
  textVacant: {
    color: '#059669',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 8,
  },
});
