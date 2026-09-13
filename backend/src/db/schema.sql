-- ====================================================================
-- College Classroom Attendance System - Database Schema (Neon PostgreSQL)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables in reverse dependency order for clean migrations
DROP TABLE IF EXISTS challenge_nonces CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS attendance_sessions CASCADE;
DROP TABLE IF EXISTS esp32_devices CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users table (Teachers and Administrators)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher')),
    department VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- 2. Classes table
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_name VARCHAR(255) NOT NULL,      -- e.g., "Computer Engineering"
    subject VARCHAR(255) NOT NULL,         -- e.g., "Computer Networks"
    semester VARCHAR(50) NOT NULL,         -- e.g., "5"
    division VARCHAR(50) NOT NULL,         -- e.g., "A"
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_classes_teacher ON classes(teacher_id);

-- 3. Students table
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_number VARCHAR(100) UNIQUE NOT NULL, -- e.g., "EN2024CS001"
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    plain_password VARCHAR(255),                    -- Visible to Admin for student account management
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_students_enrollment ON students(enrollment_number);
CREATE INDEX idx_students_class ON students(class_id);

-- 4. ESP32 Classroom Attendance Devices (3 Fixed Auditoriums)
CREATE TABLE esp32_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    esp32_id VARCHAR(100) UNIQUE NOT NULL,  -- e.g., "AUDITORIUM_01"
    device_name VARCHAR(255) NOT NULL,      -- e.g., "Auditorium 1 Presence Node"
    classroom_id VARCHAR(100) NOT NULL,     -- e.g., "AUDITORIUM_1"
    service_uuid VARCHAR(100) NOT NULL,     -- BLE Service UUID
    char_challenge_uuid VARCHAR(100) NOT NULL, -- BLE Characteristic Challenge UUID
    char_response_uuid VARCHAR(100) NOT NULL,  -- BLE Characteristic Response UUID
    secret_key VARCHAR(255) NOT NULL,       -- 256-bit Hex secret key for HMAC-SHA256
    device_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (device_status IN ('active', 'maintenance', 'revoked')),
    firmware_version VARCHAR(50) DEFAULT '1.0.0',
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_esp32_id ON esp32_devices(esp32_id);
CREATE INDEX idx_esp32_classroom ON esp32_devices(classroom_id);

-- 5. Attendance Sessions (Teacher starts a lecture in an Auditorium)
CREATE TABLE attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    esp32_id UUID NOT NULL REFERENCES esp32_devices(id) ON DELETE CASCADE,
    auditorium_id VARCHAR(50),              -- e.g. "AUDITORIUM_01"
    auditorium_name VARCHAR(100),           -- e.g. "Auditorium 1"
    session_name VARCHAR(255) NOT NULL,     -- e.g. "Computer Networks - Routing Protocols"
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,      -- Nullable: active until closed by teacher
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_class ON attendance_sessions(class_id);
CREATE INDEX idx_sessions_esp32 ON attendance_sessions(esp32_id);
CREATE INDEX idx_sessions_status ON attendance_sessions(status);
CREATE INDEX idx_sessions_auditorium ON attendance_sessions(auditorium_id);

-- 6. Attendance Records
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    esp32_id UUID NOT NULL REFERENCES esp32_devices(id) ON DELETE CASCADE,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'rejected')),
    rejection_reason TEXT,
    verification_nonce VARCHAR(255),
    rssi_dbm INTEGER,
    verification_latency_ms INTEGER,
    ip_address VARCHAR(100),
    device_info VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_session_student UNIQUE (session_id, student_id)
);

CREATE INDEX idx_records_session ON attendance_records(session_id);
CREATE INDEX idx_records_student ON attendance_records(student_id);
CREATE INDEX idx_records_class ON attendance_records(class_id);
CREATE INDEX idx_records_marked_at ON attendance_records(marked_at);

-- 7. Challenge Nonces (Replay Attack Defense Table)
CREATE TABLE IF NOT EXISTS challenge_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nonce VARCHAR(255) UNIQUE NOT NULL,
    student_id VARCHAR(100),
    esp32_id VARCHAR(100),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nonces_nonce ON challenge_nonces(nonce);
CREATE INDEX IF NOT EXISTS idx_nonces_expires ON challenge_nonces(expires_at);
