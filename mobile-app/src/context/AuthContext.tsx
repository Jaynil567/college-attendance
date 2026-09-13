import React, { createContext, useContext, useState, useEffect } from 'react';
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

interface MobileAuthContextType {
  student: StudentProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (enrollmentNumber: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const MobileAuthContext = createContext<MobileAuthContextType | undefined>(undefined);

export const MobileAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const login = async (enrollmentNumber: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await MobileApiService.login(enrollmentNumber, password);
      if (res.data.success && res.data.token) {
        setToken(res.data.token);
        setStudent(res.data.student);
        setAuthToken(res.data.token);
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

  const logout = () => {
    setToken(null);
    setStudent(null);
    setAuthToken(null);
  };

  return (
    <MobileAuthContext.Provider value={{ student, token, isLoading, login, logout }}>
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
