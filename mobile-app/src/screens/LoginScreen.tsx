import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useMobileAuth } from '../context/AuthContext';
import { DEFAULT_API_URL, setApiBaseUrl, mobileApi } from '../services/api';

export const LoginScreen: React.FC = () => {
  const { login, isLoading } = useMobileAuth();
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(mobileApi.defaults.baseURL || DEFAULT_API_URL);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!enrollmentNumber.trim() || !password.trim()) {
      setErrorMessage('Please enter both enrollment number and password.');
      return;
    }
    setErrorMessage(null);
    const result = await login(enrollmentNumber.trim().toUpperCase(), password);
    if (!result.success && result.message) {
      setErrorMessage(result.message);
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
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>BLE PRESENCE VERIFICATION</Text>
          </View>
          <Text style={styles.title}>Student Attendance</Text>
          <Text style={styles.subtitle}>Sign in with your college-issued enrollment ID</Text>
        </View>

        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>ENROLLMENT NUMBER</Text>
            <TextInput
              style={styles.input}
              value={enrollmentNumber}
              onChangeText={setEnrollmentNumber}
              placeholder="e.g. EN2024CS001"
              autoCapitalize="characters"
              placeholderTextColor="#94A3B8"
            />
          </View>

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
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Notice: Self-registration disallowed */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Official College Portal</Text>
          <Text style={styles.noticeDesc}>
            Accounts are provisioned directly by the department faculty. Use your official college credentials.
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
  header: {
    alignItems: 'center',
    marginBottom: 20,
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
