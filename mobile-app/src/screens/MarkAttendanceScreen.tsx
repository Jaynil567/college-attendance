import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useMobileAuth } from '../context/AuthContext';
import { MobileApiService } from '../services/api';
import { BleService, BleScanResult, HandshakeResult } from '../services/bleService';

export const MarkAttendanceScreen: React.FC = () => {
  const { student } = useMobileAuth();
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Verification pipeline states: 'idle' | 'scanning' | 'handshake' | 'verifying' | 'success' | 'rejected'
  const [flowState, setFlowState] = useState<'idle' | 'scanning' | 'handshake' | 'verifying' | 'success' | 'rejected'>('idle');
  const [detectedBeacon, setDetectedBeacon] = useState<BleScanResult | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<string>('');
  const [rejectionCode, setRejectionCode] = useState<string>('');
  const [verificationStats, setVerificationStats] = useState<any>(null);

  // Mode toggle (Hardware vs Simulator)
  const [isSimulator, setIsSimulator] = useState(false);

  const fetchSession = async () => {
    try {
      setLoadingSession(true);
      const res = await MobileApiService.getActiveSession();
      if (res.data.success && res.data.sessions && res.data.sessions.length > 0) {
        setActiveSession(res.data.sessions[0]);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Failed to load active session', err);
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleMarkAttendance = async () => {
    if (!activeSession || !student) return;

    try {
      setFlowState('scanning');
      setVerificationFeedback('Scanning for Classroom ESP32 BLE Beacon...');

      // Step 1 & 2: Discover Classroom ESP32
      BleService.setSimulationMode(isSimulator);
      const scanResult = await BleService.scanForClassroomEsp32(activeSession.service_uuid);
      setDetectedBeacon(scanResult);

      // Step 3 & 4: Cryptographic Challenge-Response Handshake
      setFlowState('handshake');
      setVerificationFeedback(`Connecting to ${scanResult.esp32Id}... Exchanging 32-byte cryptographic challenge.`);

      const handshakeResult: HandshakeResult = await BleService.performChallengeResponse({
        esp32Id: scanResult.esp32Id,
        studentEnrollment: student.enrollmentNumber,
        targetServiceUuid: scanResult.serviceUuid,
      });

      if (!handshakeResult.success) {
        setFlowState('rejected');
        setRejectionCode('BLE_HANDSHAKE_FAILED');
        setVerificationFeedback(handshakeResult.error || 'Failed to exchange cryptographic proof with ESP32.');
        return;
      }

      // Step 5 & 6: Submit Verification Result to Backend API
      setFlowState('verifying');
      setVerificationFeedback('Transmitting cryptographic proof to Neon PostgreSQL backend...');

      const response = await MobileApiService.markAttendance({
        sessionId: activeSession.id,
        esp32Id: scanResult.esp32Id,
        challenge: handshakeResult.challenge,
        response: handshakeResult.response,
        timestamp: handshakeResult.timestamp,
        rssi: handshakeResult.rssi,
        deviceInfo: scanResult.isSimulated ? 'Mobile Device (BLE Simulator)' : 'Mobile Phone (Hardware BLE)',
      });

      // Step 7: Attendance Inserted
      if (response.data.success) {
        setFlowState('success');
        setVerificationFeedback('Physical presence confirmed! Attendance recorded.');
        setVerificationStats({
          markedAt: new Date().toLocaleTimeString(),
          rssi: handshakeResult.rssi,
          latency: handshakeResult.latencyMs,
          esp32Id: scanResult.esp32Id,
        });
      }
    } catch (err: any) {
      // Step 8: Rejection Handling
      setFlowState('rejected');
      const errData = err.response?.data;
      setRejectionCode(errData?.error || 'ATTENDANCE_REJECTED');
      setVerificationFeedback(errData?.message || 'Attendance submission failed. Please verify with instructor.');
    }
  };

  const resetFlow = () => {
    setFlowState('idle');
    setVerificationFeedback('');
    setRejectionCode('');
    fetchSession();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Student Welcome Banner */}
      <View style={styles.studentBanner}>
        <Text style={styles.studentGreeting}>Welcome, {student?.fullName}</Text>
        <Text style={styles.studentMeta}>
          {student?.enrollmentNumber} • {student?.subject || 'Engineering'} (Sem {student?.semester}-{student?.division})
        </Text>
      </View>

      {/* Simulator / Hardware Mode Toggle */}
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Presence Verification Mode:</Text>
        <TouchableOpacity
          style={[styles.toggleButton, isSimulator ? styles.toggleActive : styles.toggleInactive]}
          onPress={() => setIsSimulator(!isSimulator)}
        >
          <Text style={[styles.toggleText, isSimulator ? styles.toggleTextActive : styles.toggleTextInactive]}>
            {isSimulator ? '⚡ Simulator Mode' : '📡 Hardware BLE Mode'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Session Card */}
      {loadingSession ? (
        <View style={styles.cardCenter}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.cardSub}>Checking for active lectures...</Text>
        </View>
      ) : !activeSession ? (
        <View style={styles.cardCenter}>
          <Text style={styles.cardTitle}>No Active Lecture</Text>
          <Text style={styles.cardSub}>
            There are currently no attendance sessions open for your assigned class ({student?.subject || 'Class'}).
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchSession}>
            <Text style={styles.refreshText}>Check Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.sessionCard}>
          <View style={styles.activeTag}>
            <Text style={styles.activeTagText}>ATTENDANCE WINDOW OPEN</Text>
          </View>
          <Text style={styles.sessionTitle}>{activeSession.session_name}</Text>
          <Text style={styles.sessionClass}>
            {activeSession.class_name} • {activeSession.subject}
          </Text>
          <View style={styles.sessionMetaRow}>
            <Text style={styles.sessionMeta}>Node: {activeSession.device_esp32_id || 'ESP32'}</Text>
            <Text style={styles.sessionMeta}>Room: {activeSession.classroom_id || '302'}</Text>
            <Text style={styles.sessionMeta}>
              Closes: {new Date(activeSession.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      )}

      {/* Verification State Panel */}
      {flowState === 'idle' && activeSession && (
        <View style={styles.actionCard}>
          <View style={styles.radarIcon}>
            <Text style={styles.radarEmoji}>📡</Text>
          </View>
          <Text style={styles.actionTitle}>Classroom Presence Check</Text>
          <Text style={styles.actionDesc}>
            Make sure Bluetooth is enabled and you are inside the classroom near the ESP32 node.
          </Text>

          <TouchableOpacity style={styles.markButton} onPress={handleMarkAttendance}>
            <Text style={styles.markButtonText}>Mark Attendance</Text>
          </TouchableOpacity>
        </View>
      )}

      {(flowState === 'scanning' || flowState === 'handshake' || flowState === 'verifying') && (
        <View style={styles.statusCard}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.statusTitle}>
            {flowState === 'scanning' && 'Scanning for ESP32...'}
            {flowState === 'handshake' && 'Cryptographic Handshake...'}
            {flowState === 'verifying' && 'Validating with Neon DB...'}
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

      {flowState === 'success' && (
        <View style={[styles.statusCard, styles.successCard]}>
          <Text style={styles.statusEmoji}>✅</Text>
          <Text style={styles.successTitle}>Attendance Recorded!</Text>
          <Text style={styles.successDesc}>{verificationFeedback}</Text>

          {verificationStats && (
            <View style={styles.statsBox}>
              <Text style={styles.statItem}>Status: <Text style={styles.statBold}>PRESENT</Text></Text>
              <Text style={styles.statItem}>Timestamp: <Text style={styles.statBold}>{verificationStats.markedAt}</Text></Text>
              <Text style={styles.statItem}>Hardware Node: <Text style={styles.statBold}>{verificationStats.esp32Id}</Text></Text>
              <Text style={styles.statItem}>BLE Signal (RSSI): <Text style={styles.statBold}>{verificationStats.rssi} dBm</Text></Text>
              <Text style={styles.statItem}>Verification Latency: <Text style={styles.statBold}>{verificationStats.latency} ms</Text></Text>
            </View>
          )}

          <TouchableOpacity style={styles.resetButton} onPress={resetFlow}>
            <Text style={styles.resetButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {flowState === 'rejected' && (
        <View style={[styles.statusCard, styles.rejectedCard]}>
          <Text style={styles.statusEmoji}>❌</Text>
          <Text style={styles.rejectedTitle}>Attendance Rejected</Text>
          <View style={styles.codePill}>
            <Text style={styles.codeText}>{rejectionCode || 'VERIFICATION_ERROR'}</Text>
          </View>
          <Text style={styles.rejectedDesc}>{verificationFeedback}</Text>

          <TouchableOpacity style={[styles.resetButton, styles.retryButton]} onPress={resetFlow}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
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
});
