import axios from 'axios';

export const DEFAULT_API_URL = 'https://college-attendance-blond.vercel.app/api';

export const mobileApi = axios.create({
  baseURL: DEFAULT_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Auth token storage in memory for cross-platform support
let studentToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  studentToken = token;
  if (token) {
    mobileApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete mobileApi.defaults.headers.common['Authorization'];
  }
};

export const setApiBaseUrl = (newUrl: string) => {
  mobileApi.defaults.baseURL = newUrl;
};

export const MobileApiService = {
  login: (enrollmentNumber: string, password: string, deviceFingerprint?: string) =>
    mobileApi.post('/auth/student/login', { enrollmentNumber, password, deviceFingerprint }),

  getMe: () => mobileApi.get('/auth/me'),

  getActiveSession: () => mobileApi.get('/sessions/active'),

  getAuditoriumsStatus: () => mobileApi.get('/sessions/auditoriums-status'),

  markAttendance: (data: {
    sessionId: string;
    deviceFingerprint: string;
    biometricVerified: boolean;
    bleRssi?: number;
    bleDeviceName?: string;
    hasSimCard?: boolean;
    simCarrier?: string;
    simCountry?: string;
    simPhoneNumber?: string;
  }) => mobileApi.post('/attendance/mark', data),

  getHistory: () => mobileApi.get('/attendance/history'),

  // Teacher Endpoints
  teacherLogin: (email: string, password: string) =>
    mobileApi.post('/auth/teacher/login', { email, password }),

  startSession: (data: { auditoriumId: string; sessionName: string; targetDivisions?: string[]; requireSimVerification?: boolean }) =>
    mobileApi.post('/sessions/start', data),

  endSession: (id: string) =>
    mobileApi.post(`/sessions/${id}/end`),

  getSessionDetails: (id: string) =>
    mobileApi.get(`/sessions/${id}`),

  manualMarkAttendance: (data: { sessionId: string; division: string; rollNumber: string }) =>
    mobileApi.post('/attendance/manual-mark', data),

  deleteAttendanceRecord: (recordId: string) =>
    mobileApi.delete(`/attendance/record/${recordId}`),

  // Student Directory & Device Management
  getStudents: (params?: { search?: string; division?: string; status?: string }) =>
    mobileApi.get('/students', { params }),

  updateStudent: (id: string, data: any) =>
    mobileApi.put(`/students/${id}`, data),

  resetAllPasswords: () =>
    mobileApi.post('/students/reset-all-passwords'),

  // Past Sessions & Reports
  getAllSessions: () =>
    mobileApi.get('/sessions/all'),

  getAttendanceReport: (params?: { sessionId?: string; startDate?: string; endDate?: string }) =>
    mobileApi.get('/attendance/report', { params }),
};
