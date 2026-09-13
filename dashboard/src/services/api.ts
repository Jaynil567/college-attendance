import axios from 'axios';

export const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT Bearer token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('attendance_teacher_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API client functions
export const ApiService = {
  // Auth
  teacherLogin: (credentials: { email: string; password: string }) =>
    api.post('/auth/teacher/login', credentials),
  getMe: () => api.get('/auth/me'),

  // Classes
  getClasses: () => api.get('/classes'),
  getClassById: (id: string) => api.get(`/classes/${id}`),
  createClass: (data: any) => api.post('/classes', data),
  updateClass: (id: string, data: any) => api.put(`/classes/${id}`, data),
  deleteClass: (id: string) => api.delete(`/classes/${id}`),

  // Students
  getStudents: (params?: { search?: string; classId?: string; status?: string }) =>
    api.get('/students', { params }),
  createStudent: (data: any) => api.post('/students', data),
  updateStudent: (id: string, data: any) => api.put(`/students/${id}`, data),
  deleteStudent: (id: string) => api.delete(`/students/${id}`),

  // Devices
  getDevices: () => api.get('/devices'),
  registerDevice: (data: any) => api.post('/devices', data),
  rotateDeviceKey: (id: string) => api.put(`/devices/${id}/rotate-key`),

  // Sessions
  getActiveSessions: () => api.get('/sessions/active'),
  getSessionById: (id: string) => api.get(`/sessions/${id}`),
  startSession: (data: { classId: string; esp32Id: string; sessionName: string; durationMinutes: number }) =>
    api.post('/sessions/start', data),
  closeSession: (id: string) => api.post(`/sessions/${id}/close`),

  // Attendance Reports & Export
  getAttendanceReport: (params?: { classId?: string; studentId?: string; startDate?: string; endDate?: string; status?: string }) =>
    api.get('/attendance/report', { params }),
  
  exportExcel: async (params?: { classId?: string; startDate?: string; endDate?: string }) => {
    const response = await api.get('/attendance/export', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Attendance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};
