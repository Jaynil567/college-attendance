import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useMobileAuth } from '../context/AuthContext';
import { DEFAULT_API_URL, setApiBaseUrl, mobileApi } from '../services/api';

export const LoginScreen: React.FC = () => {
  const { loginStudent, loginTeacher, isLoading } = useMobileAuth();
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher'>('student');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(mobileApi.defaults.baseURL || DEFAULT_API_URL);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);

    if (selectedRole === 'student') {
      if (!enrollmentNumber.trim() || !password.trim()) {
        setErrorMessage('Please enter both enrollment number and password.');
        return;
      }
      const result = await loginStudent(enrollmentNumber.trim().toUpperCase(), password);
      if (!result.success && result.message) {
        setErrorMessage(result.message);
      }
    } else {
      if (!teacherEmail.trim() || !password.trim()) {
        setErrorMessage('Please enter both faculty email and password.');
        return;
      }
      const result = await loginTeacher(teacherEmail.trim().toLowerCase(), password);
      if (!result.success && result.message) {
        setErrorMessage(result.message);
      }
    }
  };

  const handleSaveServerUrl = () => {
    if (serverUrl.trim()) {
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      setApiBaseUrl(cleanUrl);
      setConfigSuccess('Server URL updated!');
      setTimeout(() => setConfigSuccess(null), 3000);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* LJIET University Official Logo */}
        <View style={styles.logoHeader}>
          <Image source={require('../../assets/ljiet_logo.png')} style={styles.logoImage} resizeMode="contain" />
        </View>
        {/* Role Toggle Selector */}
        <View style={styles.roleSelectorContainer}>
          <TouchableOpacity
            style={[styles.roleTab, selectedRole === 'student' && styles.roleTabActive]}
            onPress={() => {
              setSelectedRole('student');
              setErrorMessage(null);
            }}
          >
            <Text style={[styles.roleTabText, selectedRole === 'student' && styles.roleTabTextActive]}>
              🎓 Student
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleTab, selectedRole === 'teacher' && styles.roleTabActive]}
            onPress={() => {
              setSelectedRole('teacher');
              setErrorMessage(null);
            }}
          >
            <Text style={[styles.roleTabText, selectedRole === 'teacher' && styles.roleTabTextActive]}>
              👨‍🏫 Teacher
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <View style={[styles.badge, selectedRole === 'teacher' && styles.badgeTeacher]}>
            <Text style={[styles.badgeText, selectedRole === 'teacher' && styles.badgeTeacherText]}>
              {selectedRole === 'teacher' ? 'FACULTY PRESENCE BEACON' : 'BLE PRESENCE VERIFICATION'}
            </Text>
          </View>
          <Text style={styles.title}>
            {selectedRole === 'teacher' ? 'Faculty Portal' : 'Student Attendance'}
          </Text>
          <Text style={styles.subtitle}>
            {selectedRole === 'teacher'
              ? 'Sign in to start 3-Auditorium BLE attendance broadcast'
              : 'Sign in with your college-issued enrollment ID'}
          </Text>
        </View>

        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.form}>
          {selectedRole === 'student' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ENROLLMENT NUMBER</Text>
              <TextInput
                style={styles.input}
                value={enrollmentNumber}
                onChangeText={setEnrollmentNumber}
                placeholder="e.g. 24002171210010"
                autoCapitalize="characters"
                placeholderTextColor="#94A3B8"
              />
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FACULTY EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                value={teacherEmail}
                onChangeText={setTeacherEmail}
                placeholder="e.g. teacher@college.edu"
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#94A3B8"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              placeholderTextColor="#94A3B8"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              selectedRole === 'teacher' && styles.buttonTeacher,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {selectedRole === 'teacher' ? 'Sign In as Faculty' : 'Sign In as Student'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Notice */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>
            {selectedRole === 'teacher' ? 'Faculty Instructions' : 'Official College Portal'}
          </Text>
          <Text style={styles.noticeDesc}>
            {selectedRole === 'teacher'
              ? 'Select your auditorium (Engineering, Architecture, or LAW) and subject to broadcast BLE presence for students.'
              : 'Accounts are provisioned directly by the department faculty. Use your registered enrollment number.'}
          </Text>
        </View>

        {/* Server Config Toggle */}
        <TouchableOpacity
          style={styles.serverConfigToggle}
          onPress={() => setShowServerConfig(!showServerConfig)}
        >
          <Text style={styles.serverConfigToggleText}>
            ⚙️ {showServerConfig ? 'Hide Server Settings' : 'Server Connection Settings'}
          </Text>
        </TouchableOpacity>

        {showServerConfig && (
          <View style={styles.serverConfigCard}>
            <Text style={styles.configLabel}>BACKEND API URL:</Text>
            <TextInput
              style={styles.configInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              placeholder="https://your-backend.onrender.com/api"
              placeholderTextColor="#94A3B8"
            />
            {configSuccess && <Text style={styles.configSuccessText}>{configSuccess}</Text>}
            <TouchableOpacity style={styles.saveConfigBtn} onPress={handleSaveServerUrl}>
              <Text style={styles.saveConfigBtnText}>Save URL</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  roleSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  roleTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  roleTabTextActive: {
    color: '#0F172A',
  },
  badgeTeacher: {
    backgroundColor: '#DCFCE7',
  },
  badgeTeacherText: {
    color: '#15803D',
  },
  buttonTeacher: {
    backgroundColor: '#059669',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoHeader: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  badge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  badgeText: {
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  form: {
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    textAlign: 'center',
  },
  noticeBox: {
    marginTop: 18,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  noticeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  noticeDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
  },
  serverConfigToggle: {
    marginTop: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  serverConfigToggleText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  serverConfigCard: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  configLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  configInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
  },
  configSuccessText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  saveConfigBtn: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveConfigBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
