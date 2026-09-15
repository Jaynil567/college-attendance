import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MobileApiService } from '../services/api';

export const HistoryScreen: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await MobileApiService.getHistory();
      if (res.data.success) {
        setRecords(res.data.records || []);
        setStats(res.data.stats || null);
      }
    } catch (err) {
      console.error('Error fetching attendance history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header Metric Cards */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.percentage}%</Text>
            <Text style={styles.statLbl}>Attendance</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, styles.presentVal]}>{stats.presentCount}</Text>
            <Text style={styles.statLbl}>Present</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, styles.absentVal]}>{stats.absentCount || 0}</Text>
            <Text style={styles.statLbl}>Absent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.totalSessions}</Text>
            <Text style={styles.statLbl}>Total Lectures</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.centerText}>Loading division attendance history...</Text>
        </View>
      ) : records.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No Lecture Sessions Conducted Yet</Text>
          <Text style={styles.emptySub}>All completed lectures for your division will automatically appear here.</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchHistory}>
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isPresent = item.status === 'present';
            return (
              <View style={[styles.recordCard, !isPresent && styles.absentRecordCard]}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordSubject}>{item.subject || item.className || 'Lecture'}</Text>
                  <View style={[styles.statusPill, isPresent ? styles.presentPill : styles.absentPill]}>
                    <Text style={[styles.statusText, isPresent ? styles.presentText : styles.absentText]}>
                      {isPresent ? 'PRESENT ✅' : 'ABSENT ❌'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.recordTopic}>{item.session_name}</Text>

                <View style={styles.recordFooter}>
                  <Text style={styles.recordTime}>
                    {new Date(item.marked_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </Text>
                  <Text style={styles.recordNode}>{item.auditorium_name || 'Auditorium'}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  presentVal: {
    color: '#059669',
  },
  absentVal: {
    color: '#DC2626',
  },
  statLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  list: {
    paddingBottom: 24,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  absentRecordCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FAFAFA',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recordSubject: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  presentPill: {
    backgroundColor: '#DCFCE7',
  },
  absentPill: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  presentText: {
    color: '#15803D',
  },
  absentText: {
    color: '#B91C1C',
  },
  recordTopic: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  recordTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  recordNode: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centerText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  refreshBtn: {
    marginTop: 14,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshBtnText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
});
