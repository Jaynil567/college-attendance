import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  Modal,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useMobileAuth } from '../context/AuthContext';
import { MobileApiService, DEFAULT_API_URL } from '../services/api';
import { BleService } from '../services/bleService';

const AUDITORIUM_OPTIONS = [
  { id: 'AUDITORIUM_01', name: 'Engineering Auditorium', icon: '⚙️' },
  { id: 'AUDITORIUM_02', name: 'Architecture Auditorium', icon: '🏛️' },
  { id: 'AUDITORIUM_03', name: 'LAW Auditorium', icon: '⚖️' },
];

// BLE Service UUIDs for each auditorium beacon
const AUDITORIUM_BLE_UUIDS: Record<string, string> = {
  AUDITORIUM_01: '4fafc201-1fb5-459e-8fcc-c5c9c3319141',
  AUDITORIUM_02: '4fafc201-1fb5-459e-8fcc-c5c9c3319142',
  AUDITORIUM_03: '4fafc201-1fb5-459e-8fcc-c5c9c3319143',
};

const ALL_DIVISIONS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9',
];

export const TeacherSessionScreen: React.FC = () => {
  const { teacher, token, logout } = useMobileAuth();
  const [selectedAudiId, setSelectedAudiId] = useState<'AUDITORIUM_01' | 'AUDITORIUM_02' | 'AUDITORIUM_03'>('AUDITORIUM_01');
  const [subjectTitle, setSubjectTitle] = useState('');
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [sessionRecords, setSessionRecords] = useState<any[]>([]);
  const [auditoriumsStatus, setAuditoriumsStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bleActive, setBleActive] = useState(false);

  // Manual Check-In State
  const [manualDivision, setManualDivision] = useState('');
  const [manualRollNumber, setManualRollNumber] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);

  const handleManualCheckIn = async () => {
    if (!activeSession) return;
    const div = manualDivision.trim().toUpperCase();
    const roll = manualRollNumber.trim();
    if (!div) {
      Alert.alert('Division Required', 'Please enter or select Division (e.g. A1, A2)');
      return;
    }
    if (!roll) {
      Alert.alert('Roll Number Required', 'Please enter student Roll Number (e.g. 86)');
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await MobileApiService.manualMarkAttendance({
        sessionId: activeSession.id,
        division: div,
        rollNumber: roll,
      });

      if (res.data.success) {
        Alert.alert('✅ Success', res.data.message || 'Student marked Present!');
        setManualRollNumber('');
        fetchSessionRecords(activeSession.id);
      } else {
        Alert.alert('Failed', res.data.message || 'Could not mark attendance');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to mark attendance';
      Alert.alert('Error', msg);
    } finally {
      setManualSubmitting(false);
    }
  };

  const toggleDivision = (div: string) => {
    setSelectedDivisions((prev) =>
      prev.includes(div) ? prev.filter((d) => d !== div) : [...prev, div]
    );
  };

  const selectDivCategory = (cat: 'A' | 'B' | 'C' | 'ALL' | 'NONE') => {
    if (cat === 'ALL') setSelectedDivisions([...ALL_DIVISIONS]);
    else if (cat === 'NONE') setSelectedDivisions([]);
    else setSelectedDivisions(ALL_DIVISIONS.filter((d) => d.startsWith(cat)));
  };

  const timerRef = useRef<any>(null);
  const pollRef = useRef<any>(null);

  // 1. Initial Load: Check if teacher has an active session
  const checkStatus = async () => {
    try {
      const res = await MobileApiService.getAuditoriumsStatus();
      if (res.data.success && res.data.auditoriums) {
        setAuditoriumsStatus(res.data.auditoriums);

        // Check if any auditorium has a session created by this teacher
        const myActive = res.data.auditoriums.find(
          (a: any) =>
            a.isLive &&
            a.activeSession &&
            (a.activeSession.teacherName === teacher?.fullName ||
              a.activeSession.created_by === teacher?.id)
        );

        if (myActive && myActive.activeSession) {
          setActiveSession(myActive.activeSession);
          setSelectedAudiId(myActive.id);
          fetchSessionRecords(myActive.activeSession.id);
        } else if (!activeSession) {
          setActiveSession(null);
          setSessionRecords([]);
        }
      }
    } catch (err: any) {
      console.warn('[TeacherSession] checkStatus error', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionRecords = async (sessionId: string) => {
    try {
      const res = await MobileApiService.getSessionDetails(sessionId);
      if (res.data.success && res.data.records) {
        setSessionRecords(res.data.records);
      }
    } catch (err) {
      console.warn('[TeacherSession] fetchSessionRecords error', err);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Timer & Polling effect during active session
  useEffect(() => {
    if (activeSession) {
      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      // Poll attendance records every 3 seconds
      pollRef.current = setInterval(() => {
        if (activeSession.id) {
          fetchSessionRecords(activeSession.id);
        }
      }, 3000);
      // Ensure BLE advertising is running
      const bleUuid = AUDITORIUM_BLE_UUIDS[selectedAudiId];
      if (bleUuid) {
        BleService.startAdvertising(bleUuid).then((bleRes) => {
          setBleActive(bleRes.success);
        });
      }
    } else {
      setElapsedSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      BleService.stopAdvertising();
      setBleActive(false);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      // Stop BLE advertising when component unmounts
      BleService.stopAdvertising();
    };
  }, [activeSession?.id]);

  const handleStartSession = async () => {
    if (!subjectTitle.trim()) {
      Alert.alert('Subject Required', 'Please enter a Subject / Lecture title before starting attendance.');
      return;
    }

    if (selectedDivisions.length === 0) {
      Alert.alert('Divisions Required', 'Please select at least one division for this session.');
      return;
    }

    const audiObj = AUDITORIUM_OPTIONS.find((a) => a.id === selectedAudiId);
    const audiStatus = auditoriumsStatus.find((a) => a.id === selectedAudiId);

    if (audiStatus && audiStatus.isLive) {
      Alert.alert(
        'Auditorium Busy',
        `${audiObj?.name || selectedAudiId} currently has an ongoing lecture (${audiStatus.activeSession?.sessionName || 'Active'}). Please select another auditorium or wait for it to end.`
      );
      return;
    }

    setStarting(true);
    try {
      const res = await MobileApiService.startSession({
        auditoriumId: selectedAudiId,
        sessionName: subjectTitle.trim(),
        targetDivisions: selectedDivisions,
      });

      if (res.data.success && res.data.session) {
        setActiveSession(res.data.session);
        setSessionRecords([]);
        setElapsedSeconds(0);

        // Start BLE beacon broadcasting for this auditorium
        const bleUuid = AUDITORIUM_BLE_UUIDS[selectedAudiId];
        if (bleUuid) {
          const bleRes = await BleService.startAdvertising(bleUuid);
          setBleActive(bleRes.success);
          if (!bleRes.success) {
            Alert.alert('BLE Warning', `Could not start BLE beacon: ${bleRes.error || 'Unknown error'}. Students may not be able to verify proximity.`);
          }
        }

        await checkStatus();
      } else {
        Alert.alert('Error', res.data.message || 'Could not start attendance session.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to start session. Check your internet connection.';
      Alert.alert('Start Failed', msg);
    } finally {
      setStarting(false);
    }
  };

  const handleDownloadSheet = async () => {
    if (!activeSession?.id) return;
    const sessionTitle = activeSession.session_name || activeSession.sessionName || subjectTitle || 'Session';
    const cleanName = sessionTitle.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `${cleanName}_${dateStr}.xlsx`;
    const url = `${DEFAULT_API_URL}/attendance/export?sessionId=${activeSession.id}`;

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
        Alert.alert('Download Error', `Server returned status ${downloadResult.status}. Make sure you are logged in.`);
      }
    } catch (err: any) {
      console.warn('[TeacherSession] FileSystem download failed', err);
      Alert.alert('Download Failed', err.message || 'Could not download attendance sheet.');
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;

    Alert.alert(
      'End Attendance Session?',
      `Are you sure you want to stop attendance? ${sessionRecords.length} students have been recorded.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            setEnding(true);
            try {
              await MobileApiService.endSession(activeSession.id);

              // Stop BLE beacon broadcasting
              await BleService.stopAdvertising();
              setBleActive(false);

              Alert.alert(
                'Attendance Completed',
                `Attendance recorded for ${sessionRecords.length} students in ${activeSession.sessionName || subjectTitle}.`
              );
              setActiveSession(null);
              setSessionRecords([]);
              setSubjectTitle('');
              await checkStatus();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Could not end session.');
            } finally {
              setEnding(false);
            }
          },
        },
      ]
    );
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Syncing 3-Auditorium status...</Text>
      </View>
    );
  }

  const selectedAudiObj = AUDITORIUM_OPTIONS.find((a) => a.id === selectedAudiId);

  return (
    <View style={styles.container}>
      {/* Top Faculty Header */}
      <View style={styles.facultyHeader}>
        <View style={styles.facultyInfo}>
          <Text style={styles.facultyBadge}>👨‍🏫 FACULTY ATTENDANCE BEACON</Text>
          <Text style={styles.facultyName}>{teacher?.fullName || 'College Faculty'}</Text>
          <Text style={styles.facultyDept}>{teacher?.department || teacher?.email || 'General Engineering'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={checkStatus} />}
      >
        {/* ACTIVE SESSION STATE */}
        {activeSession ? (
          <View style={styles.activeCard}>
            <View style={styles.activeBanner}>
              <View style={styles.pulseDot} />
              <Text style={styles.activeBannerText}>📡 BLE PRESENCE BROADCAST ACTIVE</Text>
            </View>

            <Text style={styles.activeAudiName}>
              {selectedAudiObj?.icon} {selectedAudiObj?.name}
            </Text>
            <Text style={styles.activeSubject}>
              {activeSession.session_name || activeSession.sessionName || subjectTitle}
            </Text>

            {/* Live Counter & Timer Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{sessionRecords.length}</Text>
                <Text style={styles.statLabel}>Students Present</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{formatTimer(elapsedSeconds)}</Text>
                <Text style={styles.statLabel}>Elapsed Time (5-10m)</Text>
              </View>
            </View>

            <Text style={styles.broadcastTip}>
              Keep this screen active while students in {selectedAudiObj?.name} tap "Mark Attendance" on their phones.
            </Text>

            {/* BLE Beacon Status */}
            <View style={[styles.bleBadge, bleActive ? styles.bleBadgeActive : styles.bleBadgeInactive]}>
              <Text style={styles.bleBadgeIcon}>{bleActive ? '📡' : '⚠️'}</Text>
              <View style={styles.bleBadgeInfo}>
                <Text style={[styles.bleBadgeTitle, bleActive ? styles.bleBadgeTitleActive : styles.bleBadgeTitleInactive]}>
                  {bleActive ? 'BLE Beacon Broadcasting' : 'BLE Beacon Inactive'}
                </Text>
                <Text style={styles.bleBadgeDesc}>
                  {bleActive
                    ? 'Students can detect your phone for attendance verification'
                    : 'Bluetooth may be disabled. Students cannot verify proximity.'}
                </Text>
              </View>
              {bleActive && <View style={styles.blePulseDot} />}
            </View>

            {/* Manual Check-In Button */}
            <TouchableOpacity
              style={styles.manualCheckInBtn}
              onPress={() => {
                if (selectedDivisions.length > 0 && !manualDivision) {
                  setManualDivision(selectedDivisions[0]);
                }
                setIsManualModalVisible(true);
              }}
            >
              <Text style={styles.manualCheckInBtnText}>✏️ Manual Mark Present (Division & Roll No)</Text>
            </TouchableOpacity>

            {/* Real-Time Attendance Stream List */}
            <View style={styles.liveListContainer}>
              <Text style={styles.liveListTitle}>
                Real-Time Check-In Stream ({sessionRecords.length})
              </Text>
              {sessionRecords.length === 0 ? (
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListEmoji}>⏳</Text>
                  <Text style={styles.emptyListText}>Waiting for students to check in...</Text>
                  <Text style={styles.emptyListSub}>Students in this room will appear here automatically</Text>
                </View>
              ) : (
                [...sessionRecords].sort((a, b) => {
                  const gA = a.group_name || '';
                  const gB = b.group_name || '';
                  if (gA !== gB) return gA.localeCompare(gB);
                  const dA = a.division || '';
                  const dB = b.division || '';
                  if (dA !== dB) return dA.localeCompare(dB);
                  const rA = parseInt((a.roll_number || '0').replace(/\D/g, ''), 10) || 0;
                  const rB = parseInt((b.roll_number || '0').replace(/\D/g, ''), 10) || 0;
                  if (rA !== rB) return rA - rB;
                  return (a.roll_number || '').localeCompare(b.roll_number || '');
                }).map((rec, index) => (
                  <View key={rec.id || index} style={styles.recordRow}>
                    <View style={styles.recordLeft}>
                      <Text style={styles.recordName}>{rec.full_name || 'Student'}</Text>
                      <Text style={styles.recordEnrollment}>Group: {rec.group_name || '-'} | Div: {rec.division || '-'} | Roll: {rec.roll_number || '-'} | {rec.enrollment_number}</Text>
                    </View>
                    <View style={styles.recordRight}>
                      <Text style={styles.recordTime}>
                        {rec.marked_at
                          ? new Date(rec.marked_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : 'Verified'}
                      </Text>
                      <Text style={styles.recordBadge}>✅ Verified</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Download Attendance Sheet Button */}
            <TouchableOpacity
              style={styles.downloadSheetBtn}
              onPress={handleDownloadSheet}
            >
              <Text style={styles.downloadSheetBtnText}>📥 Download Attendance Sheet (.xlsx)</Text>
            </TouchableOpacity>

            {/* End Session Button */}
            <TouchableOpacity
              style={[styles.endSessionBtn, ending && styles.btnDisabled]}
              onPress={handleEndSession}
              disabled={ending}
            >
              {ending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.endSessionBtnText}>⏹️ Stop Attendance Broadcast</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* START NEW SESSION STATE */
          <View style={styles.startCard}>
            <Text style={styles.sectionHeading}>Step 1: Select Your Lecture Auditorium</Text>
            <Text style={styles.sectionSubtitle}>
              Select the auditorium where your concurrent lecture is taking place:
            </Text>

            {/* 3 Auditorium Cards */}
            <View style={styles.audiGrid}>
              {AUDITORIUM_OPTIONS.map((audi) => {
                const isSelected = selectedAudiId === audi.id;
                const status = auditoriumsStatus.find((a) => a.id === audi.id);
                const isBusy = status && status.isLive;

                return (
                  <TouchableOpacity
                    key={audi.id}
                    style={[
                      styles.audiChoiceCard,
                      isSelected && styles.audiChoiceCardSelected,
                      isBusy && styles.audiChoiceCardBusy,
                    ]}
                    onPress={() => setSelectedAudiId(audi.id as any)}
                  >
                    <Text style={styles.audiChoiceIcon}>{audi.icon}</Text>
                    <Text style={[styles.audiChoiceName, isSelected && styles.audiChoiceNameSelected]}>
                      {audi.name}
                    </Text>
                    <View style={styles.audiStatusBadge}>
                      {isBusy ? (
                        <Text style={styles.audiBusyText}>🔴 In Use ({status.activeSession?.sessionName})</Text>
                      ) : (
                        <Text style={styles.audiVacantText}>🟢 Available</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Step 2: Subject Input */}
            <Text style={[styles.sectionHeading, { marginTop: 24 }]}>Step 2: Enter Subject / Lecture Title</Text>
            <TextInput
              style={styles.subjectInput}
              value={subjectTitle}
              onChangeText={setSubjectTitle}
              placeholder="e.g. Cloud Computing & Distributed Systems"
              placeholderTextColor="#94A3B8"
            />

            {/* Step 3: Target Divisions */}
            <Text style={[styles.sectionHeading, { marginTop: 24 }]}>
              Step 3: Select Target Divisions ({selectedDivisions.length} Selected)
            </Text>
            <Text style={styles.sectionSubtitle}>
              Only students belonging to selected divisions will get the "Mark Attendance" button on their app:
            </Text>

            {/* Division Quick Filter Bar */}
            <View style={styles.divPresetRow}>
              <TouchableOpacity style={styles.divPresetChip} onPress={() => selectDivCategory('A')}>
                <Text style={styles.divPresetText}>All A's</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.divPresetChip} onPress={() => selectDivCategory('B')}>
                <Text style={styles.divPresetText}>All B's</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.divPresetChip} onPress={() => selectDivCategory('C')}>
                <Text style={styles.divPresetText}>All C's</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.divPresetChip} onPress={() => selectDivCategory('ALL')}>
                <Text style={styles.divPresetText}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.divPresetChip} onPress={() => selectDivCategory('NONE')}>
                <Text style={styles.divPresetText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {/* Division Chips Grid */}
            <View style={styles.divGrid}>
              {ALL_DIVISIONS.map((div) => {
                const isSelected = selectedDivisions.includes(div);
                return (
                  <TouchableOpacity
                    key={div}
                    style={[styles.divChip, isSelected && styles.divChipSelected]}
                    onPress={() => toggleDivision(div)}
                  >
                    <Text style={[styles.divChipText, isSelected && styles.divChipTextSelected]}>
                      {div}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notice info */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>⚡ 10-Minute Phone BLE Attendance</Text>
              <Text style={styles.infoDesc}>
                Once you click start, your phone broadcasts the attendance beacon for {selectedAudiObj?.name}. Students in this room can mark attendance in 5-10 minutes.
              </Text>
            </View>

            {/* Start Button */}
            <TouchableOpacity
              style={[styles.startSessionBtn, starting && styles.btnDisabled]}
              onPress={handleStartSession}
              disabled={starting}
            >
              {starting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.startSessionBtnText}>
                  🟢 Start Attendance in {selectedAudiObj?.name}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Manual Check-In Modal */}
        <Modal
          visible={isManualModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsManualModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>✏️ Manual Present Check-In</Text>
              <Text style={styles.modalSub}>
                Enter Division and Roll Number to mark a student Present manually if their phone verification failed.
              </Text>

              <Text style={styles.inputLabel}>Select Division:</Text>
              <View style={styles.modalDivRow}>
                {(selectedDivisions.length > 0 ? selectedDivisions : ALL_DIVISIONS.slice(0, 9)).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.modalDivChip, manualDivision === d && styles.modalDivChipActive]}
                    onPress={() => setManualDivision(d)}
                  >
                    <Text style={[styles.modalDivText, manualDivision === d && styles.modalDivTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.modalInput}
                placeholder="Division (e.g. A1, B2)"
                value={manualDivision}
                onChangeText={setManualDivision}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Enter Roll Number:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Roll Number (e.g. 86, 1, 44)"
                value={manualRollNumber}
                onChangeText={setManualRollNumber}
                keyboardType="number-pad"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setIsManualModalVisible(false)}
                >
                  <Text style={styles.modalBtnCancelText}>Done / Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSubmit, manualSubmitting && styles.btnDisabled]}
                  onPress={handleManualCheckIn}
                  disabled={manualSubmitting}
                >
                  {manualSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalBtnSubmitText}>✅ Mark Present</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
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
  facultyHeader: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  facultyInfo: {
    flex: 1,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  startCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  audiGrid: {
    gap: 10,
  },
  audiChoiceCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
  },
  audiChoiceCardSelected: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  audiChoiceCardBusy: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  audiChoiceIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  audiChoiceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  audiChoiceNameSelected: {
    color: '#065F46',
  },
  audiStatusBadge: {
    marginTop: 6,
  },
  audiVacantText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  audiBusyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  subjectInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  infoDesc: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 4,
    lineHeight: 16,
  },
  startSessionBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  startSessionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  activeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 8,
  },
  activeBannerText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeAudiName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeSubject: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#059669',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  broadcastTip: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 16,
  },
  liveListContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
  },
  liveListTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyList: {
    padding: 24,
    alignItems: 'center',
  },
  emptyListEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyListText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  emptyListSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  recordLeft: {
    flex: 1,
  },
  recordName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  recordEnrollment: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  recordRight: {
    alignItems: 'flex-end',
  },
  recordTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  recordBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  downloadSheetBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  downloadSheetBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  // Division selection styles
  divPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 10,
  },
  divPresetChip: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  divPresetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  divGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  divChip: {
    width: '18%',
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  divChipSelected: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  divChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  divChipTextSelected: {
    color: '#FFFFFF',
  },
  endSessionBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  endSessionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  // BLE Beacon Status Badge
  bleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
  },
  bleBadgeActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  bleBadgeInactive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  bleBadgeIcon: { fontSize: 20, marginRight: 10 },
  bleBadgeInfo: { flex: 1 },
  bleBadgeTitle: { fontSize: 12, fontWeight: '800' },
  bleBadgeTitleActive: { color: '#065F46' },
  bleBadgeTitleInactive: { color: '#991B1B' },
  bleBadgeDesc: { fontSize: 10, color: '#64748B', marginTop: 2 },
  blePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  manualCheckInBtn: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  manualCheckInBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 6,
  },
  modalDivRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  modalDivChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalDivChipActive: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  modalDivText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  modalDivTextActive: {
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalBtnCancelText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  modalBtnSubmit: {
    backgroundColor: '#059669',
  },
  modalBtnSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
