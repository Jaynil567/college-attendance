import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { MobileApiService, DEFAULT_API_URL } from '../services/api';
import { useMobileAuth } from '../context/AuthContext';

const ALL_DIVISIONS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9',
];

export const TeacherStudentsScreen: React.FC = () => {
  const { token } = useMobileAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('ALL');
  const [resettingPasswords, setResettingPasswords] = useState(false);

  const fetchStudents = async () => {
    try {
      const res = await MobileApiService.getStudents();
      if (res.data.success && res.data.students) {
        setStudents(res.data.students);
        filterList(res.data.students, searchQuery, selectedDivision);
      }
    } catch (err: any) {
      console.warn('[TeacherStudents] fetchStudents error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const filterList = (list: any[], query: string, div: string) => {
    let result = list;

    if (div && div !== 'ALL') {
      result = result.filter((s) => s.division === div);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (s) =>
          (s.full_name && s.full_name.toLowerCase().includes(q)) ||
          (s.enrollment_number && s.enrollment_number.toLowerCase().includes(q)) ||
          (s.division && s.division.toLowerCase().includes(q)) ||
          (s.roll_number && String(s.roll_number).includes(q)) ||
          (s.group_name && s.group_name.toLowerCase().includes(q))
      );
    }

    setFilteredStudents(result);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    filterList(students, text, selectedDivision);
  };

  const handleSelectDivision = (div: string) => {
    setSelectedDivision(div);
    filterList(students, searchQuery, div);
  };

  const handleResetDevice = (studentId: string, studentName: string) => {
    Alert.alert(
      'Reset Device Binding?',
      `Are you sure you want to unbind phone device for ${studentName}? They will be able to log in from a new phone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Device',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await MobileApiService.updateStudent(studentId, { device_id: null });
              if (res.data.success) {
                Alert.alert('✅ Device Unbound', `Device binding reset for ${studentName}.`);
                fetchStudents();
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Could not reset device binding.');
            }
          },
        },
      ]
    );
  };

  const handleResetAllPasswords = () => {
    Alert.alert(
      '⚠️ Reset All Passwords',
      'This will generate new random 4-digit passwords for ALL active students. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Passwords',
          style: 'destructive',
          onPress: async () => {
            setResettingPasswords(true);
            try {
              const res = await MobileApiService.resetAllPasswords();
              if (res.data.success) {
                Alert.alert(
                  '✅ Passwords Reset',
                  `Successfully generated new passwords for ${res.data.count || 'all'} students. You can download the credentials sheet.`
                );
                fetchStudents();
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Could not reset passwords.');
            } finally {
              setResettingPasswords(false);
            }
          },
        },
      ]
    );
  };

  const handleDownloadCredentials = async () => {
    const fileName = `Student_Credentials_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const url = `${DEFAULT_API_URL}/students/export-credentials`;

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
      Alert.alert('Download Failed', err.message || 'Could not download credentials.');
    }
  };

  const boundCount = students.filter((s) => !!s.device_id).length;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading Student Directory...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <Text style={styles.title}>👥 Student Directory & Devices</Text>
        <Text style={styles.subTitle}>
          Total: {students.length} Students | {boundCount} Bound Devices
        </Text>

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadCredentials}>
            <Text style={styles.downloadBtnText}>📥 Export Credentials (.xlsx)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resetAllBtn, resettingPasswords && styles.btnDisabled]}
            onPress={handleResetAllPasswords}
            disabled={resettingPasswords}
          >
            {resettingPasswords ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.resetAllBtnText}>🔄 Reset All Passwords</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar Input */}
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search by Name, Enrollment No, Div, Roll No..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={handleSearch}
        />

        {/* Division Filter Chips Horizontal Scroll */}
        <FlatList
          horizontal
          data={['ALL', ...ALL_DIVISIONS]}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          style={styles.divList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.divChip, selectedDivision === item && styles.divChipActive]}
              onPress={() => handleSelectDivision(item)}
            >
              <Text style={[styles.divChipText, selectedDivision === item && styles.divChipTextActive]}>
                {item === 'ALL' ? 'All Divisions' : item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Student List */}
      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id || item.enrollment_number}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchStudents} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔎</Text>
            <Text style={styles.emptyText}>No students found</Text>
            <Text style={styles.emptySub}>Try searching with a different name or division</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isBound = !!item.device_id;
          return (
            <View style={styles.studentCard}>
              <View style={styles.studentMainInfo}>
                <Text style={styles.studentName}>{item.full_name}</Text>
                <Text style={styles.studentDetails}>
                  Group: {item.group_name || '-'} | Div: {item.division || '-'} | Roll: {item.roll_number || '-'}
                </Text>
                <Text style={styles.studentEnrollment}>{item.enrollment_number}</Text>
              </View>

              <View style={styles.studentRightActions}>
                {isBound ? (
                  <View style={styles.boundBadge}>
                    <Text style={styles.boundBadgeText}>🔒 LOCKED</Text>
                  </View>
                ) : (
                  <View style={styles.unboundBadge}>
                    <Text style={styles.unboundBadgeText}>🔓 Unbound</Text>
                  </View>
                )}

                {isBound && (
                  <TouchableOpacity
                    style={styles.resetDeviceBtn}
                    onPress={() => handleResetDevice(item.id, item.full_name)}
                  >
                    <Text style={styles.resetDeviceBtnText}>Reset Phone</Text>
                  </TouchableOpacity>
                )}
              </View>
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
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  downloadBtn: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  resetAllBtn: {
    flex: 1,
    backgroundColor: '#D97706',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetAllBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 10,
  },
  divList: {
    flexGrow: 0,
  },
  divChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginRight: 6,
  },
  divChipActive: {
    backgroundColor: '#FFFFFF',
  },
  divChipText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  divChipTextActive: {
    color: '#064E3B',
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
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  studentMainInfo: {
    flex: 1,
    paddingRight: 10,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentDetails: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    fontWeight: '500',
  },
  studentEnrollment: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  studentRightActions: {
    alignItems: 'flex-end',
  },
  boundBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  boundBadgeText: {
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: '800',
  },
  unboundBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unboundBadgeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  resetDeviceBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  resetDeviceBtnText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '700',
  },
});
