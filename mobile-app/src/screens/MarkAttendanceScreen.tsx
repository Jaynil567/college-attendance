import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useMobileAuth } from '../context/AuthContext';
import { MobileApiService } from '../services/api';
import { BleService, BleScanResult, HandshakeResult } from '../services/bleService';

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
  } | null;
  hasMarkedAttendance: boolean;
  device?: {
    service_uuid: string;
    char_challenge_uuid: string;
    char_response_uuid: string;
  } | null;
}

export const MarkAttendanceScreen: React.FC = () => {
  const { student } = useMobileAuth();
  const [auditoriums, setAuditoriums] = useState<AuditoriumStatus[]>([
    { id: 'AUDITORIUM_01', name: 'Engineering Auditorium', isLive: false, activeSession: null, hasMarkedAttendance: false },
    { id: 'AUDITORIUM_02', name: 'Architecture Auditorium', isLive: false, activeSession: null, hasMarkedAttendance: false },
    { id: 'AUDITORIUM_03', name: 'LAW Auditorium', isLive: false, activeSession: null, hasMarkedAttendance: false },
  ]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active targeted verification flow
  const [activeAudiTarget, setActiveAudiTarget] = useState<AuditoriumStatus | null>(null);
  const [flowState, setFlowState] = useState<'idle' | 'scanning' | 'handshake' | 'verifying' | 'success' | 'rejected'>('idle');
  const [detectedBeacon, setDetectedBeacon] = useState<BleScanResult | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<string>('');
  const [rejectionCode, setRejectionCode] = useState<string>('');
  const [verificationStats, setVerificationStats] = useState<any>(null);

  // Simulator vs Hardware BLE toggle
  const [isSimulator, setIsSimulator] = useState(false);

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
    const interval = setInterval(fetchAuditoriums, 4000); // 4-second live status poll
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAuditoriums();
  };

  const handleMarkAttendance = async (audi: AuditoriumStatus) => {
    if (!audi.activeSession || !student) return;

    setActiveAudiTarget(audi);
    setFlowState('scanning');
    setVerificationFeedback(`Scanning for ${audi.name} ESP32 BLE Beacon...`);

    try {
      BleService.setSimulationMode(isSimulator);
      const serviceUuid = audi.device?.service_uuid || '4fafc201-1fb5-459e-8fcc-c5c9c3319141';

      // Step 1: Scan for this specific Auditorium's ESP32
      const scanResult = await BleService.scanForClassroomEsp32(serviceUuid, audi.id, `${audi.name} ESP32`);
      setDetectedBeacon(scanResult);

      // Step 2: Cryptographic Handshake
      setFlowState('handshake');
      setVerificationFeedback(`Connected to ${audi.name} ESP32. Exchanging cryptographic challenge...`);

      const handshakeResult: HandshakeResult = await BleService.performChallengeResponse({
        esp32Id: audi.id,
        studentEnrollment: student.enrollmentNumber,
        targetServiceUuid: serviceUuid,
      });

      if (!handshakeResult.success) {
        setFlowState('rejected');
        setRejectionCode('BLE_HANDSHAKE_FAILED');
        setVerificationFeedback(handshakeResult.error || 'Failed to exchange cryptographic proof with ESP32.');
        return;
      }

      // Step 3: Transmit verification to Backend
      setFlowState('verifying');
      setVerificationFeedback('Recording attendance in Neon PostgreSQL...');

      const response = await MobileApiService.markAttendance({
        sessionId: audi.activeSession.id,
        esp32Id: audi.id,
        challenge: handshakeResult.challenge,
        response: handshakeResult.response,
        timestamp: handshakeResult.timestamp,
        rssi: handshakeResult.rssi,
        deviceInfo: isSimulator ? 'Mobile App (Simulator)' : 'Mobile App (BLE Hardware)',
      });

      if (response.data.success) {
        setFlowState('success');
        setVerificationFeedback(`Presence confirmed in ${audi.name}! Attendance recorded.`);
        setVerificationStats({
          auditoriumName: audi.name,
          subject: audi.activeSession.subject,
          markedAt: new Date().toLocaleTimeString(),
          rssi: handshakeResult.rssi,
          latency: handshakeResult.latencyMs,
          esp32Id: audi.id,
        });

        // Update local state immediately
        setAuditoriums((prev) =>
          prev.map((item) => (item.id === audi.id ? { ...item, hasMarkedAttendance: true } : item))
        );
      }
    } catch (err: any) {
      setFlowState('rejected');
      const errData = err.response?.data;
      setRejectionCode(errData?.error || 'ATTENDANCE_REJECTED');
      setVerificationFeedback(errData?.message || 'Verification failed. Please ensure you are inside the auditorium.');
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
          Enrollment No: <Text style={styles.statBold}>{student?.enrollmentNumber}</Text>
        </Text>
        <Text style={styles.studentSub}>
          Select the Auditorium you are currently seated in to mark your attendance.
        </Text>
      </View>

      {/* Simulator / BLE Toggle */}
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Verification Engine:</Text>
        <TouchableOpacity
          style={[styles.toggleButton, isSimulator ? styles.toggleActive : styles.toggleInactive]}
          onPress={() => setIsSimulator(!isSimulator)}
        >
          <Text style={[styles.toggleText, isSimulator ? styles.toggleTextActive : styles.toggleTextInactive]}>
            {isSimulator ? '⚡ Simulator Mode' : '📡 Hardware BLE Mode'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Verification In-Progress Card */}
      {(flowState === 'scanning' || flowState === 'handshake' || flowState === 'verifying') && (
        <View style={styles.statusCard}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.statusTitle}>
            {flowState === 'scanning' && `Scanning ${activeAudiTarget?.name}...`}
            {flowState === 'handshake' && 'ESP32 Cryptographic Proof...'}
            {flowState === 'verifying' && 'Validating with Neon Database...'}
          </Text>
          <Text style={styles.statusDesc}>{verificationFeedback}</Text>
          {detectedBeacon && (
            <View style={styles.beaconPill}>
              <Text style={styles.beaconText}>
                {detectedBeacon.deviceName} ({detectedBeacon.rssi} dBm)
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Verification Success Card */}
      {flowState === 'success' && (
        <View style={[styles.statusCard, styles.successCard]}>
          <Text style={styles.statusEmoji}>✅</Text>
          <Text style={styles.successTitle}>Attendance Recorded!</Text>
          <Text style={styles.successDesc}>{verificationFeedback}</Text>

          {verificationStats && (
            <View style={styles.statsBox}>
              <Text style={styles.statItem}>Auditorium: <Text style={styles.statBold}>{verificationStats.auditoriumName}</Text></Text>
              <Text style={styles.statItem}>Subject: <Text style={styles.statBold}>{verificationStats.subject}</Text></Text>
              <Text style={styles.statItem}>Status: <Text style={styles.statBold}>PRESENT</Text></Text>
              <Text style={styles.statItem}>Time: <Text style={styles.statBold}>{verificationStats.markedAt}</Text></Text>
              <Text style={styles.statItem}>ESP32 Hardware: <Text style={styles.statBold}>{verificationStats.esp32Id}</Text></Text>
            </View>
          )}

          <TouchableOpacity style={styles.resetButton} onPress={resetFlow}>
            <Text style={styles.resetButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Verification Rejection Card */}
      {flowState === 'rejected' && (
        <View style={[styles.statusCard, styles.rejectedCard]}>
          <Text style={styles.statusEmoji}>❌</Text>
          <Text style={styles.rejectedTitle}>Verification Failed</Text>
          <View style={styles.codePill}>
            <Text style={styles.codeText}>{rejectionCode || 'VERIFICATION_ERROR'}</Text>
          </View>
          <Text style={styles.rejectedDesc}>{verificationFeedback}</Text>

          <TouchableOpacity style={[styles.resetButton, styles.retryButton]} onPress={resetFlow}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>College Auditoriums (3 Rooms)</Text>
        <Text style={styles.sectionSub}>Live lectures & presence checkpoints</Text>
      </View>

      {/* 3 Auditorium Cards */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingText}>Syncing Auditorium Status...</Text>
        </View>
      ) : (
        auditoriums.map((audi) => {
          const isLive = audi.isLive && !!audi.activeSession;
          const hasMarked = audi.hasMarkedAttendance;

          return (
            <View
              key={audi.id}
              style={[
                styles.audiCard,
                isLive ? (hasMarked ? styles.audiCardMarked : styles.audiCardLive) : styles.audiCardVacant,
              ]}
            >
              {/* Auditorium Card Header */}
              <View style={styles.audiHeader}>
                <View style={styles.audiTitleRow}>
                  <Text style={styles.audiEmoji}>{isLive ? '🏛️' : '🏫'}</Text>
                  <Text style={styles.audiName}>{audi.name}</Text>
                </View>

                <View
                  style={[
                    styles.badge,
                    isLive ? (hasMarked ? styles.badgeMarked : styles.badgeLive) : styles.badgeVacant,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      isLive ? (hasMarked ? styles.badgeTextMarked : styles.badgeTextLive) : styles.badgeTextVacant,
                    ]}
                  >
                    {hasMarked ? '✅ ATTENDANCE RECORDED' : isLive ? '🟢 LIVE LECTURE' : '⚪ VACANT'}
                  </Text>
                </View>
              </View>

              {/* Lecture Details (if Live) */}
              {isLive && audi.activeSession && (
                <View style={styles.lectureBox}>
                  <Text style={styles.lectureSubject}>{audi.activeSession.subject}</Text>
                  <Text style={styles.lectureTeacher}>👨‍🏫 Faculty: {audi.activeSession.teacherName}</Text>
                  <Text style={styles.lectureTime}>
                    Started at {new Date(audi.activeSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}

              {/* No lecture state */}
              {!isLive && (
                <View style={styles.vacantBox}>
                  <Text style={styles.vacantText}>No lecture is currently running in this auditorium.</Text>
                </View>
              )}

              {/* Action Button */}
              {isLive && (
                <View style={styles.buttonContainer}>
                  {hasMarked ? (
                    <View style={styles.markedBanner}>
                      <Text style={styles.markedBannerText}>✅ You are marked PRESENT in this lecture</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.markAudiButton}
                      onPress={() => handleMarkAttendance(audi)}
                      disabled={flowState !== 'idle'}
                    >
                      <Text style={styles.markAudiButtonText}>
                        👉 Mark Attendance in {audi.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  studentBanner: {
    backgroundColor: '#1E3A8A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  studentGreeting: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  studentMeta: {
    color: '#93C5FD',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  toggleActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  toggleInactive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#92400E',
  },
  toggleTextInactive: {
    color: '#1D4ED8',
  },
  cardCenter: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  refreshButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
  },
  refreshText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  sessionCard: {
    backgroundColor: '#047857',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  activeTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  activeTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sessionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  sessionClass: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 4,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  sessionMeta: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radarIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  radarEmoji: {
    fontSize: 28,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  actionDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20,
  },
  markButton: {
    backgroundColor: '#2563EB',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  markButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
  },
  statusDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  beaconPill: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  beaconText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  successCard: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  statusEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065F46',
  },
  successDesc: {
    fontSize: 12,
    color: '#047857',
    textAlign: 'center',
    marginTop: 4,
  },
  statsBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  statItem: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 4,
  },
  statBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  resetButton: {
    marginTop: 18,
    backgroundColor: '#059669',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  rejectedCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  rejectedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#991B1B',
  },
  codePill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  codeText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  rejectedDesc: {
    fontSize: 12,
    color: '#B91C1C',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#DC2626',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  studentSub: {
    color: '#BFDBFE',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
  },
  sectionHeader: {
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  audiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  audiCardLive: {
    borderColor: '#3B82F6',
  },
  audiCardMarked: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  audiCardVacant: {
    borderColor: '#E2E8F0',
    opacity: 0.85,
  },
  audiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  audiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audiEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  audiName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeLive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  badgeMarked: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  badgeVacant: {
    backgroundColor: '#F1F5F9',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeTextLive: {
    color: '#1D4ED8',
  },
  badgeTextMarked: {
    color: '#047857',
  },
  badgeTextVacant: {
    color: '#64748B',
  },
  lectureBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lectureSubject: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  lectureTeacher: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    fontWeight: '600',
  },
  lectureTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  vacantBox: {
    paddingVertical: 10,
  },
  vacantText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: 4,
  },
  markedBanner: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  markedBannerText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '800',
  },
  markAudiButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  markAudiButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
