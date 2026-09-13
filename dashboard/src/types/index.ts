export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'teacher';
  department?: string;
}

export interface ClassItem {
  id: string;
  class_name: string;
  subject: string;
  semester: string;
  division: string;
  teacher_id: string | null;
  teacher_name?: string;
  teacher_email?: string;
  student_count?: number;
  created_at?: string;
}

export interface Student {
  id: string;
  enrollment_number: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  class_id: string | null;
  class_name?: string;
  subject?: string;
  semester?: string;
  division?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface ESP32Device {
  id: string;
  esp32_id: string;
  device_name: string;
  classroom_id: string;
  service_uuid: string;
  char_challenge_uuid: string;
  char_response_uuid: string;
  secret_key: string;
  device_status: 'active' | 'maintenance' | 'revoked';
  firmware_version: string;
  last_seen_at: string;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  class_name?: string;
  subject?: string;
  semester?: string;
  division?: string;
  esp32_id: string;
  device_esp32_id?: string;
  device_name?: string;
  classroom_id?: string;
  session_name: string;
  start_time: string;
  end_time: string;
  status: 'active' | 'closed' | 'cancelled';
  present_count?: number;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  enrollment_number: string;
  student_name: string;
  class_name: string;
  subject: string;
  semester: string;
  division: string;
  session_name: string;
  marked_at: string;
  status: 'present' | 'absent' | 'late' | 'rejected';
  rejection_reason?: string;
  esp32_id: string;
  rssi_dbm?: number;
  verification_latency_ms?: number;
}
