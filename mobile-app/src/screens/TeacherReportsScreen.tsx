import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { MobileApiService, DEFAULT_API_URL } from '../services/api';
import { useMobileAuth } from '../context/AuthContext';

export const TeacherReportsScreen: React.FC = () => {
  const { token } = useMobileAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionRecords, setSessionRecords] = useState<Record<string, any[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  const fetchSessions = async () => {
    try {
      const res = await MobileApiService.getAllSessions();
      if (res.data.success && res.data.sessions) {
        setSessions(res.data.sessions);
      }
    } catch (err: any) {
      console.warn('[TeacherReports] fetchSessions error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const toggleExpand = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }

    setExpandedSessionId(sessionId);

    if (!sessionRecords[sessionId]) {
      setLoadingDetails((prev) => ({ ...prev, [sessionId]: true }));
      try {
        const res = await MobileApiService.getSessionDetails(sessionId);
        if (res.data.success && res.data.records) {
          setSessionRecords((prev) => ({ ...prev, [sessionId]: res.data.records }));
        }
      } catch (err) {
        console.warn('[TeacherReports] getSessionDetails error', err);
      } finally {
        setLoadingDetails((prev) => ({ ...prev, [sessionId]: false }));
      }
    }
  };

  const handleDownloadSessionSheet = async (sessionId: string, sessionTitle: string) => {
    const cleanName = (sessionTitle || 'Session').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `${cleanName}_${dateStr}.xlsx`;
    const url = `${DEFAULT_API_URL}/attendance/export?sessionId=${sessionId}`;

    try {
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const downloadResult = await FileSystem.downloadAsync(url, fileUri, { headers });

      if (downloadResult.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: `Save ${fileName}`,
            UTI: 'com.microsoft.excel.xlsx',
          });
        } else {
          await WebBrowser.openBrowserAsync(url);
        }
      } else {
        Alert.alert('Download Error', `Server status ${downloadResult.status}`);
      }
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Could not download session attendance sheet.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading Session Ledger & Reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📜 Session Ledger & Reports</Text>
        <Text style={styles.subTitle}>
          Total Sessions Recorded: {sessions.length}
        </Text>
      </View>

      {/* Sessions List */}
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchSessions} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No attendance sessions found</Text>
            <Text style={styles.emptySub}>Started sessions will appear in this ledger</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = expandedSessionId === item.id;
          const records = sessionRecords[item.id] || [];
          const isLoadingRecords = loadingDetails[item.id];
          const isClosed = item.status === 'closed' || item.end_time;

          return (
            <View style={styles.sessionCard}>
              <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item.id)}>
                <View style={styles.cardMain}>
                  <View style={styles.titleRow}>
                    <Text style={styles.sessionTitle}>{item.session_name || item.sessionName || 'Lecture'}</Text>
                    <View style={[styles.statusBadge, isClosed ? styles.statusClosed : styles.statusActive]}>
                      <Text style={[styles.statusText, isClosed ? styles.statusTextClosed : styles.statusTextActive]}>
                        {isClosed ? 'Closed' : '🔴 LIVE'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.sessionMeta}>
                    {item.auditorium_name || item.auditorium_id || 'Auditorium'} | Teacher: {item.teacher_name || 'Faculty'}
                  </Text>
                  <Text style={styles.sessionTime}>
                    📅 {new Date(item.start_time).toLocaleDateString()} at{' '}
                    {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {/* Action row */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.downloadExcelBtn}
                  onPress={() => handleDownloadSessionSheet(item.id, item.session_name || item.sessionName)}
                >
                  <Text style={styles.downloadExcelBtnText}>📥 Download Sheet (.xlsx)</Text>
                </TouchableOpacity>
              </View>

              {/* Expanded Record Stream */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  <Text style={styles.recordsTitle}>
                    Recorded Students ({records.length})
                  </Text>

                  {isLoadingRecords ? (
                    <ActivityIndicator color="#059669" style={{ marginVertical: 12 }} />
                  ) : records.length === 0 ? (
                    <Text style={styles.noRecordsText}>No attendance records in this session</Text>
                  ) : (
                    records.map((rec, index) => (
                      <View key={rec.id || index} style={styles.recordRow}>
                        <View style={styles.recordLeft}>
                          <Text style={styles.studentName}>{rec.full_name}</Text>
                          <Text style={styles.studentMeta}>
                            Group: {rec.group_name || '-'} | Div: {rec.division || '-'} | Roll: {rec.roll_number || '-'} | {rec.enrollment_number}
                          </Text>
                        </View>
                        <Text style={styles.presentBadge}>✅ Present</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  header: {
    backgroundColor: '#064E3B',
    padding: 16,
    paddingTop: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subTitle: {
    fontSize: 12,
    color: '#A7F3D0',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMain: {
    flex: 1,
    paddingRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  statusActive: {
    backgroundColor: '#FEF2F2',
  },
  statusClosed: {
    backgroundColor: '#F1F5F9',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextActive: {
    color: '#DC2626',
  },
  statusTextClosed: {
    color: '#64748B',
  },
  sessionMeta: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  sessionTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  expandIcon: {
    fontSize: 12,
    color: '#94A3B8',
  },
  cardActions: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  downloadExcelBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  downloadExcelBtnText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '700',
  },
  expandedContent: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 14,
  },
  recordsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
  },
  noRecordsText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  recordLeft: {
    flex: 1,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  presentBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
});
