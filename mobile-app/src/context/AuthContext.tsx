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
  login: (enrollmentNumber: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginStudent: (enrollmentNumber: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginTeacher: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const MobileAuthContext = createContext<MobileAuthContextType | undefined>(undefined);

export const MobileAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<'student' | 'teacher' | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loginStudent = async (enrollmentNumber: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await MobileApiService.login(enrollmentNumber, password);
      if (res.data.success && res.data.token) {
        setToken(res.data.token);
        setStudent(res.data.student);
        setTeacher(null);
        setRole('student');
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
  };

  return (
    <MobileAuthContext.Provider
      value={{
        role,
        student,
        teacher,
        token,
        isLoading,
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
