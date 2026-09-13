import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { MobileApiService, setAuthToken } from '../services/api';

export interface StudentProfile {
  id: string;
  enrollmentNumber: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  classId: string | null;
  className?: string;
  subject?: string;
  semester?: string;
  division?: string;
  status: 'active' | 'inactive';
}

export interface TeacherProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department?: string;
}

interface MobileAuthContextType {
  role: 'student' | 'teacher' | null;
  student: StudentProfile | null;
  teacher: TeacherProfile | null;
  token: string | null;
  isLoading: boolean;
  deviceFingerprint: string;
  login: (enrollmentNumber: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginStudent: (enrollmentNumber: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginTeacher: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const SECURE_TOKEN_KEY = 'auth_token';
const SECURE_USER_KEY = 'user_data';
const SECURE_ROLE_KEY = 'user_role';

/**
 * Generate a unique device fingerprint for device binding
 */
function getDeviceFingerprint(): string {
  const brand = Device.brand || 'unknown';
  const model = Device.modelName || 'unknown';
  const os = Device.osVersion || 'unknown';
  const name = Device.deviceName || 'unknown';
  const type = Device.deviceType?.toString() || '0';
  return `${brand}_${model}_${os}_${name}_${type}`;
}

const MobileAuthContext = createContext<MobileAuthContextType | undefined>(undefined);

export const MobileAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<'student' | 'teacher' | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start true for auto-login check

  const deviceFingerprint = getDeviceFingerprint();

  /**
   * Auto-login: Check SecureStore for saved token on app start
   */
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
        const savedUserData = await SecureStore.getItemAsync(SECURE_USER_KEY);
        const savedRole = await SecureStore.getItemAsync(SECURE_ROLE_KEY);

        if (savedToken && savedUserData && savedRole) {
          setAuthToken(savedToken);
          setToken(savedToken);

          // Verify token is still valid with server
          try {
            const meRes = await MobileApiService.getMe();
            if (meRes.data.success) {
              if (savedRole === 'student') {
                const userData = JSON.parse(savedUserData);
                setStudent(userData);
                setTeacher(null);
                setRole('student');
              } else if (savedRole === 'teacher') {
                const userData = JSON.parse(savedUserData);
                setTeacher(userData);
                setStudent(null);
                setRole('teacher');
              }
            } else {
              // Token invalid, clear stored data
              await clearStoredSession();
            }
          } catch {
            // Server unreachable — still allow offline access with cached data
            const userData = JSON.parse(savedUserData);
            if (savedRole === 'student') {
              setStudent(userData);
              setRole('student');
            } else if (savedRole === 'teacher') {
              setTeacher(userData);
              setRole('teacher');
            }
          }
        }
      } catch (err) {
        console.error('[Auth] Failed to restore session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const clearStoredSession = async () => {
    await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
    await SecureStore.deleteItemAsync(SECURE_USER_KEY);
    await SecureStore.deleteItemAsync(SECURE_ROLE_KEY);
    setAuthToken(null);
  };

  const loginStudent = async (enrollmentNumber: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await MobileApiService.login(enrollmentNumber, password, deviceFingerprint);
      if (res.data.success && res.data.token) {
        setToken(res.data.token);
        setStudent(res.data.student);
        setTeacher(null);
        setRole('student');
        setAuthToken(res.data.token);

        // Persist session in SecureStore
        await SecureStore.setItemAsync(SECURE_TOKEN_KEY, res.data.token);
        await SecureStore.setItemAsync(SECURE_USER_KEY, JSON.stringify(res.data.student));
        await SecureStore.setItemAsync(SECURE_ROLE_KEY, 'student');

        return { success: true };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed. Verify enrollment number and password.';
      return { success: false, message: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const loginTeacher = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await MobileApiService.teacherLogin(email, password);
      if (res.data.success && res.data.token) {
        setToken(res.data.token);
        setTeacher(res.data.user);
        setStudent(null);
        setRole('teacher');
        setAuthToken(res.data.token);

        // Persist session in SecureStore
        await SecureStore.setItemAsync(SECURE_TOKEN_KEY, res.data.token);
        await SecureStore.setItemAsync(SECURE_USER_KEY, JSON.stringify(res.data.user));
        await SecureStore.setItemAsync(SECURE_ROLE_KEY, 'teacher');

        return { success: true };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed. Verify teacher email and password.';
      return { success: false, message: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setStudent(null);
    setTeacher(null);
    setRole(null);
    setAuthToken(null);
    // Clear SecureStore
    SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
    SecureStore.deleteItemAsync(SECURE_USER_KEY);
    SecureStore.deleteItemAsync(SECURE_ROLE_KEY);
  };

  return (
    <MobileAuthContext.Provider
      value={{
        role,
        student,
        teacher,
        token,
        isLoading,
        deviceFingerprint,
        login: loginStudent,
        loginStudent,
        loginTeacher,
        logout,
      }}
    >
      {children}
    </MobileAuthContext.Provider>
  );
};

export const useMobileAuth = () => {
  const context = useContext(MobileAuthContext);
  if (!context) {
    throw new Error('useMobileAuth must be used within MobileAuthProvider');
  }
  return context;
};
