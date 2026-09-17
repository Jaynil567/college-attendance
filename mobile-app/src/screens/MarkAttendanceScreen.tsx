import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useMobileAuth } from '../context/AuthContext';
import { MobileApiService } from '../services/api';
import { BleService, BleScanResult } from '../services/bleService';
import { SimService, SimStatus } from '../services/simService';

interface AuditoriumStatus {
  id: string;
  name: string;
  isLive: boolean;
  activeSession: {
    id: string;
    subject: string;
    sessionName: string;
    teacherName: string;
    startTime: string;
    presentCount: number;
    requireSimVerification?: boolean;
  } | null;
  hasMarkedAttendance: boolean;
  device?: {
    service_uuid: string;
    char_challenge_uuid: string;
    char_response_uuid: string;
  } | null;
}

// Auditorium-specific BLE Service UUIDs (match teacher's broadcast)
const AUDITORIUM_BLE_UUIDS: Record<string, string> = {
  AUDITORIUM_01: '4fafc201-1fb5-459e-8fcc-c5c9c3319141',
  AUDITORIUM_02: '4fafc201-1fb5-459e-8fcc-c5c9c3319142',
  AUDITORIUM_03: '4fafc201-1fb5-459e-8fcc-c5c9c3319143',
};

export const MarkAttendanceScreen: React.FC = () => {
  const { student, deviceFingerprint } = useMobileAuth();
  const [auditoriums, setAuditoriums] = useState<AuditoriumStatus[]>([
    { id: 'AUDITORIUM_01', name: 'Engineering Auditorium', isLive: false, activeSession: null, hasMarkedAttendance: false },
    { id: 'AUDITORIUM_02', name: 'Architecture Auditorium', isLive: false, activeSession: null, hasMarkedAttendance: false },
    { id: 'AUDITORIUM_03', name: 'LAW Auditorium', isLive: false, activeSession: null, hasMarkedAttendance: false },
  ]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [simState, setSimState] = useState<SimStatus | null>(null);

  // Verification flow state
  const [activeAudiTarget, setActiveAudiTarget] = useState<AuditoriumStatus | null>(null);
  const [flowState, setFlowState] = useState<'idle' | 'simCheck' | 'biometric' | 'scanning' | 'submitting' | 'success' | 'rejected'>('idle');
  const [verificationFeedback, setVerificationFeedback] = useState<string>('');
  const [rejectionCode, setRejectionCode] = useState<string>('');
  const [verificationStats, setVerificationStats] = useState<any>(null);

  const fetchAuditoriums = async () => {
    try {
      const res = await MobileApiService.getAuditoriumsStatus();
      if (res.data.success && res.data.auditoriums) {
        setAuditoriums(res.data.auditoriums);
      }
    } catch (err) {
      console.error('Failed to load auditoriums status', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditoriums();
    SimService.checkSimStatus().then(setSimState);
    const interval = setInterval(fetchAuditoriums, 4000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAuditoriums();
    SimService.checkSimStatus().then(setSimState);
  };

  /**
   * ANTI-CHEAT ATTENDANCE FLOW:
   * Step 1: SIM Card Hardware Verification (expo-cellular)
   * Step 2: Biometric (Fingerprint / Face ID)
   * Step 3: BLE Scan (detect teacher's phone beacon)
   * Step 4: Submit with device fingerprint & SIM state to backend
   */
  const handleMarkAttendance = async (audi: AuditoriumStatus) => {
    if (!audi.activeSession || !student) return;

    setActiveAudiTarget(audi);

    const requireSim = audi.activeSession.requireSimVerification !== false;
    let currentSim: SimStatus = {
      hasSimCard: true,
      carrierName: 'Disabled by Teacher',
      countryCode: 'in',
      mobileCountryCode: null,
      networkGeneration: 'N/A',
    };

    if (requireSim) {
      // ─── STEP 1: SIM CARD VERIFICATION ───────────────────────
      setFlowState('simCheck');
      setVerificationFeedback('Verifying active SIM card presence...');

      currentSim = await SimService.checkSimStatus();
      setSimState(currentSim);

      if (!currentSim.hasSimCard) {
        setFlowState('rejected');
        setRejectionCode('SIM_CARD_REQUIRED');
        setVerificationFeedback(currentSim.reason || '❌ Active SIM card is required in your phone.');
        return;
      }
    }

    // ─── STEP 2: BIOMETRIC VERIFICATION ─────────────────────
    setFlowState('biometric');
    setVerificationFeedback('Verifying your identity...');

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware) {
        setFlowState('rejected');
        setRejectionCode('NO_BIOMETRIC_HARDWARE');
        setVerificationFeedback('Your device does not have fingerprint/Face ID hardware. Biometric verification is required.');
        return;
      }

      if (!isEnrolled) {
        setFlowState('rejected');
        setRejectionCode('NO_BIOMETRIC_ENROLLED');
        setVerificationFeedback('No fingerprint or Face ID is set up on your device. Please set up biometric authentication in your phone settings.');
        return;
      }

      const biometricResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to mark attendance',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });

      if (!biometricResult.success) {
        setFlowState('rejected');
        setRejectionCode('BIOMETRIC_FAILED');
        setVerificationFeedback('Biometric verification failed or was cancelled. Attendance not recorded.');
        return;
      }

      // ─── STEP 3: BLE SCAN FOR TEACHER'S PHONE ─────────────
      setFlowState('scanning');
      setVerificationFeedback(`Scanning for ${audi.name} teacher beacon...`);

      const serviceUuid = AUDITORIUM_BLE_UUIDS[audi.id] || audi.device?.service_uuid || '4fafc201-1fb5-459e-8fcc-c5c9c3319141';

      const scanResult: BleScanResult = await BleService.scanForTeacherBeacon(serviceUuid, 8000);

      if (!scanResult.found) {
        setFlowState('rejected');
        setRejectionCode('BLE_NOT_FOUND');
        setVerificationFeedback(
          `Teacher's BLE beacon not detected in ${audi.name}. Make sure:\n\n` +
          '• You are inside the auditorium\n' +
          '• Teacher\'s session is active\n' +
          '• Bluetooth is turned on'
        );
        return;
      }

      // ─── STEP 4: SUBMIT TO BACKEND ─────────────────────────
      setFlowState('submitting');
      setVerificationFeedback('Recording attendance...');

      const response = await MobileApiService.markAttendance({
        sessionId: audi.activeSession.id,
        deviceFingerprint: deviceFingerprint,
        biometricVerified: true,
        bleRssi: scanResult.rssi,
        bleDeviceName: scanResult.deviceName,
        hasSimCard: currentSim.hasSimCard,
        simCarrier: currentSim.carrierName || undefined,
        simCountry: currentSim.countryCode || undefined,
        simPhoneNumber: student?.phoneNumber || undefined,
      });

      if (response.data.success) {
        setFlowState('success');
        setVerificationFeedback(`Attendance verified in ${audi.name}!`);
        setVerificationStats({
          auditoriumName: audi.name,
          subject: audi.activeSession.subject,
          markedAt: new Date().toLocaleTimeString(),
          rssi: scanResult.rssi,
          bleDevice: scanResult.deviceName,
          carrier: currentSim.carrierName,
        });

        setAuditoriums((prev) =>
          prev.map((item) => (item.id === audi.id ? { ...item, hasMarkedAttendance: true } : item))
        );
      }
    } catch (err: any) {
      setFlowState('rejected');
      const errData = err.response?.data;
      setRejectionCode(errData?.error || 'ATTENDANCE_REJECTED');
      setVerificationFeedback(errData?.message || 'Verification failed. Please try again.');
    }
  };

  const resetFlow = () => {
    setFlowState('idle');
    setActiveAudiTarget(null);
    setVerificationFeedback('');
    setRejectionCode('');
    fetchAuditoriums();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />}
    >
      {/* Student Welcome Header */}
      <View style={styles.studentBanner}>
        <Text style={styles.studentGreeting}>Hello, {student?.fullName || 'Student'}</Text>
        <Text style={styles.studentMeta}>
          Enrollment: <Text style={styles.statBold}>{student?.enrollmentNumber}</Text>
          {student?.division ? ` • Division: ${student.division}` : ''}
        </Text>
        <Text style={styles.studentSub}>
          Live session attendance checkpoint for your division.
        </Text>
      </View>

      {/* Security Badge */}
      <View style={styles.securityBadge}>
        <Text style={styles.securityIcon}>📱</Text>
        <View style={styles.securityInfo}>
          <Text style={styles.securityTitle}>SIM & Device Security Active</Text>
          <Text style={styles.securityDesc}>
            {simState?.carrierName ? `SIM: ${simState.carrierName} (${simState.networkGeneration || 'Cellular'})` : 'Active SIM Card Required'} • Fingerprint • Device Lock
          </Text>
        </View>
        <View style={[styles.securityDot, { backgroundColor: simState?.hasSimCard !== false ? '#22C55E' : '#EF4444' }]} />
      </View>

      {/* Verification In-Progress Card */}
      {(flowState === 'simCheck' || flowState === 'biometric' || flowState === 'scanning' || flowState === 'submitting') && (
        <View style={styles.statusCard}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.statusTitle}>
            {flowState === 'simCheck' && '📱 SIM Card Verification...'}
            {flowState === 'biometric' && '🔐 Fingerprint Verification...'}
            {flowState === 'scanning' && `📡 Scanning ${activeAudiTarget?.name}...`}
            {flowState === 'submitting' && '✓ Recording Attendance...'}
          </Text>
          <Text style={styles.statusDesc}>{verificationFeedback}</Text>

          {/* Progress steps */}
          <View style={styles.stepsContainer}>
            <View style={[styles.stepDot, flowState === 'simCheck' ? styles.stepActive : styles.stepDone]} />
            <View style={[styles.stepLine, flowState !== 'simCheck' ? styles.stepLineDone : {}]} />
            <View style={[styles.stepDot, flowState === 'biometric' ? styles.stepActive : (flowState === 'scanning' || flowState === 'submitting') ? styles.stepDone : styles.stepPending]} />
            <View style={[styles.stepLine, (flowState === 'scanning' || flowState === 'submitting') ? styles.stepLineDone : {}]} />
            <View style={[styles.stepDot, flowState === 'scanning' ? styles.stepActive : flowState === 'submitting' ? styles.stepDone : styles.stepPending]} />
            <View style={[styles.stepLine, flowState === 'submitting' ? styles.stepLineDone : {}]} />
            <View style={[styles.stepDot, flowState === 'submitting' ? styles.stepActive : styles.stepPending]} />
          </View>
          <View style={styles.stepsLabels}>
            <Text style={styles.stepLabel}>SIM Card</Text>
            <Text style={styles.stepLabel}>Fingerprint</Text>
            <Text style={styles.stepLabel}>BLE Scan</Text>
            <Text style={styles.stepLabel}>Submit</Text>
          </View>
        </View>
      )}

      {/* Success Card */}
      {flowState === 'success' && (
        <View style={[styles.statusCard, styles.successCard]}>
          <Text style={styles.statusEmoji}>✅</Text>
          <Text style={styles.successTitle}>Attendance Recorded!</Text>
          <Text style={styles.successDesc}>{verificationFeedback}</Text>

          {verificationStats && (
            <View style={styles.statsBox}>
              <Text style={styles.statItem}>Auditorium: <Text style={styles.statBold}>{verificationStats.auditoriumName}</Text></Text>
              <Text style={styles.statItem}>Subject: <Text style={styles.statBold}>{verificationStats.subject}</Text></Text>
              <Text style={styles.statItem}>Status: <Text style={styles.statBold}>PRESENT ✅</Text></Text>
              <Text style={styles.statItem}>Time: <Text style={styles.statBold}>{verificationStats.markedAt}</Text></Text>
              <Text style={styles.statItem}>BLE Signal: <Text style={styles.statBold}>{verificationStats.rssi} dBm</Text></Text>
              <Text style={styles.statItem}>Biometric: <Text style={styles.statBold}>Verified ✅</Text></Text>
              <Text style={styles.statItem}>Device: <Text style={styles.statBold}>Verified ✅</Text></Text>
            </View>
          )}

          <TouchableOpacity style={styles.resetButton} onPress={resetFlow}>
            <Text style={styles.resetButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rejection Card */}
      {flowState === 'rejected' && (
        <View style={[styles.statusCard, styles.rejectedCard]}>
          <Text style={styles.statusEmoji}>❌</Text>
          <Text style={styles.rejectedTitle}>Verification Failed</Text>
          <View style={styles.codePill}>
            <Text style={styles.codeText}>{rejectionCode}</Text>
          </View>
          <Text style={styles.rejectedDesc}>{verificationFeedback}</Text>

          <TouchableOpacity style={[styles.resetButton, styles.retryButton]} onPress={resetFlow}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Attendance Checkpoint</Text>
        <Text style={styles.sectionSub}>Filtered for Division {student?.division || 'Assigned'}</Text>
      </View>

      {/* Active Session for Division */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingText}>Checking active sessions...</Text>
        </View>
      ) : (() => {
        const liveAudi = auditoriums.find((a) => a.isLive && a.activeSession);
        if (liveAudi && liveAudi.activeSession) {
          const hasMarked = liveAudi.hasMarkedAttendance;
          return (
            <View style={[styles.audiCard, styles.audiCardLive]}>
              <View style={styles.audiHeader}>
                <View style={styles.audiTitleRow}>
                  <Text style={styles.audiEmoji}>📡</Text>
                  <Text style={styles.audiName}>Live Lecture Session</Text>
                </View>
                <View style={[styles.badge, hasMarked ? styles.badgeMarked : styles.badgeLive]}>
                  <Text style={[styles.badgeText, hasMarked ? styles.badgeTextMarked : styles.badgeTextLive]}>
                    {hasMarked ? '✅ PRESENT' : '🟢 LIVE'}
                  </Text>
                </View>
              </View>

              <View style={styles.lectureBox}>
                <Text style={styles.lectureSubject}>{liveAudi.activeSession.subject}</Text>
                <Text style={styles.lectureTeacher}>👨‍🏫 Faculty: {liveAudi.activeSession.teacherName}</Text>
                <Text style={styles.lectureTime}>🏛️ Location: {liveAudi.name}</Text>
                <Text style={styles.lectureTime}>
                  Started: {new Date(liveAudi.activeSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              <View style={styles.buttonContainer}>
                {hasMarked ? (
                  <View style={styles.markedBanner}>
                    <Text style={styles.markedBannerText}>✅ You are marked PRESENT for this session</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.markAudiButton}
                    onPress={() => handleMarkAttendance(liveAudi)}
                    disabled={flowState !== 'idle'}
                  >
                    <Text style={styles.markAudiButtonText}>
                      👆 Mark Attendance
                    </Text>
                    <Text style={styles.markAudiSubtext}>
                      Fingerprint → BLE Proximity → Submit
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        } else {
          return (
            <View style={styles.noSessionCard}>
              <Text style={styles.noSessionEmoji}>⏳</Text>
              <Text style={styles.noSessionTitle}>No Active Session for Division {student?.division || 'assigned'}</Text>
              <Text style={styles.noSessionDesc}>
                When your faculty starts an attendance session for your division ({student?.division || 'assigned'}), the "Mark Attendance" button will appear here automatically.
              </Text>
            </View>
          );
        }
      })()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  studentBanner: { backgroundColor: '#1E3A8A', borderRadius: 20, padding: 20, marginBottom: 12 },
  studentGreeting: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  studentMeta: { color: '#93C5FD', fontSize: 12, marginTop: 4, fontWeight: '500' },
  studentSub: { color: '#BFDBFE', fontSize: 11, marginTop: 6, lineHeight: 16 },
  statBold: { fontWeight: '700', color: '#FFFFFF' },

  // Security badge
  securityBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4',
    borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#BBF7D0',
  },
  securityIcon: { fontSize: 20, marginRight: 10 },
  securityInfo: { flex: 1 },
  securityTitle: { fontSize: 12, fontWeight: '800', color: '#166534' },
  securityDesc: { fontSize: 10, color: '#15803D', marginTop: 1 },
  securityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },

  // Status cards
  statusCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16,
  },
  statusTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 14 },
  statusDesc: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  statusEmoji: { fontSize: 48, marginBottom: 8 },

  // Progress steps
  stepsContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  stepDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#E2E8F0' },
  stepActive: { backgroundColor: '#3B82F6', borderWidth: 3, borderColor: '#BFDBFE' },
  stepDone: { backgroundColor: '#22C55E' },
  stepPending: { backgroundColor: '#E2E8F0' },
  stepLine: { width: 40, height: 3, backgroundColor: '#E2E8F0', marginHorizontal: 4 },
  stepLineDone: { backgroundColor: '#22C55E' },
  stepsLabels: { flexDirection: 'row', justifyContent: 'space-between', width: 200, marginTop: 6 },
  stepLabel: { fontSize: 9, color: '#64748B', fontWeight: '600' },

  // Success
  successCard: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#065F46' },
  successDesc: { fontSize: 12, color: '#047857', textAlign: 'center', marginTop: 4 },
  statsBox: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#DCFCE7',
  },
  statItem: { fontSize: 11, color: '#475569', marginBottom: 4 },
  resetButton: {
    marginTop: 18, backgroundColor: '#059669', paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 12, width: '100%', alignItems: 'center',
  },
  resetButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Rejected
  rejectedCard: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  rejectedTitle: { fontSize: 20, fontWeight: '800', color: '#991B1B' },
  codePill: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  codeText: { color: '#B91C1C', fontSize: 11, fontWeight: '800', fontFamily: 'monospace' },
  rejectedDesc: { fontSize: 12, color: '#B91C1C', textAlign: 'center', marginTop: 10, lineHeight: 18 },
  retryButton: { backgroundColor: '#DC2626' },
  retryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Section
  sectionHeader: { marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  sectionSub: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // Loading
  loadingBox: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 12, color: '#64748B', marginTop: 8 },

  // Auditorium cards
  audiCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 16,
    borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  audiCardLive: { borderColor: '#3B82F6' },
  audiCardMarked: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  audiCardVacant: { borderColor: '#E2E8F0', opacity: 0.85 },
  audiHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  audiTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  audiEmoji: { fontSize: 20, marginRight: 8 },
  audiName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeLive: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  badgeMarked: { backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#86EFAC' },
  badgeVacant: { backgroundColor: '#F1F5F9' },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  badgeTextLive: { color: '#1D4ED8' },
  badgeTextMarked: { color: '#047857' },
  badgeTextVacant: { color: '#64748B' },

  // Lecture info
  lectureBox: {
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0',
  },
  lectureSubject: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  lectureTeacher: { fontSize: 12, color: '#475569', marginTop: 4, fontWeight: '600' },
  lectureTime: { fontSize: 11, color: '#64748B', marginTop: 2 },
  vacantBox: { paddingVertical: 10 },
  vacantText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },

  // Buttons
  buttonContainer: { marginTop: 4 },
  markedBanner: {
    backgroundColor: '#DCFCE7', paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#86EFAC',
  },
  markedBannerText: { color: '#15803D', fontSize: 12, fontWeight: '800' },
  markAudiButton: {
    backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  },
  markAudiButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  markAudiSubtext: { color: '#BFDBFE', fontSize: 10, fontWeight: '600', marginTop: 2 },

  // No Session Card
  noSessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  noSessionEmoji: { fontSize: 36, marginBottom: 10 },
  noSessionTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  noSessionDesc: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
