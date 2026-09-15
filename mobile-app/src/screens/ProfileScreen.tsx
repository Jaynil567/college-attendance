import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useMobileAuth } from '../context/AuthContext';

export const ProfileScreen: React.FC = () => {
  const { student } = useMobileAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{student?.fullName.charAt(0) || 'S'}</Text>
        </View>
        <Text style={styles.name}>{student?.fullName}</Text>
        <View style={styles.idBadge}>
          <Text style={styles.idText}>{student?.enrollmentNumber}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.cardHeader}>🎓 ACADEMIC ENROLLMENT</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Enrollment No.</Text>
          <Text style={styles.val}>{student?.enrollmentNumber || 'N/A'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Group</Text>
          <Text style={styles.val}>{student?.groupName || 'N/A'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Division & Roll No.</Text>
          <Text style={styles.val}>
            Div {student?.division || 'N/A'} — Roll {student?.rollNumber || 'N/A'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Institute</Text>
          <Text style={styles.val}>L.J. Institute of Engineering & Tech.</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Account Status</Text>
          <Text style={[styles.val, styles.activeVal]}>{student?.status?.toUpperCase() || 'ACTIVE'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email Address</Text>
          <Text style={styles.val}>{student?.email || 'N/A'}</Text>
        </View>
        <View style={[styles.row, styles.noBorder]}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.val}>{student?.phoneNumber || 'N/A'}</Text>
        </View>
      </View>

      {/* Security Info */}
      <View style={styles.infoCard}>
        <Text style={styles.cardHeader}>🔒 SECURITY & VERIFICATION</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Device Binding</Text>
          <Text style={[styles.val, styles.activeVal]}>LOCKED ✅</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Biometric Auth</Text>
          <Text style={[styles.val, styles.activeVal]}>REQUIRED</Text>
        </View>
        <View style={[styles.row, styles.noBorder]}>
          <Text style={styles.label}>BLE Proximity</Text>
          <Text style={[styles.val, styles.activeVal]}>REQUIRED</Text>
        </View>
      </View>
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  idBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  idText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 12,
    color: '#64748B',
  },
  val: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  activeVal: {
    color: '#15803D',
    fontWeight: '800',
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  apiInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
  },
});
