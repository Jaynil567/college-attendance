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
  login: (enrollmentNumber: string, password: string) =>
    mobileApi.post('/auth/student/login', { enrollmentNumber, password }),

  getMe: () => mobileApi.get('/auth/me'),

  getActiveSession: () => mobileApi.get('/sessions/active'),

  getAuditoriumsStatus: () => mobileApi.get('/sessions/auditoriums-status'),

  markAttendance: (data: {
    sessionId: string;
    esp32Id: string;
    challenge: string;
    response: string;
    timestamp: number;
    rssi: number;
    deviceInfo?: string;
  }) => mobileApi.post('/attendance/mark', data),

  getHistory: () => mobileApi.get('/attendance/history'),
};
