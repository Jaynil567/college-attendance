import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, getDbPool, mockStore } from '../config/db.js';

export async function seedDatabase(): Promise<void> {
  try {
    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('Admin@123', salt);
    const teacherHash = await bcrypt.hash('Teacher@123', salt);
    const studentHash = await bcrypt.hash('Student@123', salt);

    // 1. Admin User
    const adminId = 'a1111111-1111-1111-1111-111111111111';
    const adminUser = {
      id: adminId,
      full_name: 'Dr. Robert Vance (Admin)',
      email: 'admin@college.edu',
      phone_number: '+1-555-0199',
      password_hash: adminHash,
      role: 'admin',
      department: 'Computer Science & Engineering',
      created_at: new Date(),
      updated_at: new Date(),
    };

    // 2. Teacher User
    const teacherId = 'b2222222-2222-2222-2222-222222222222';
    const teacherUser = {
      id: teacherId,
      full_name: 'Prof. Alan Turing',
      email: 'teacher@college.edu',
      phone_number: '+1-555-0144',
      password_hash: teacherHash,
      role: 'teacher',
      department: 'Computer Engineering',
      created_at: new Date(),
      updated_at: new Date(),
    };

    // 3. Class (Computer Engineering - Computer Networks - Sem 5 - Div A)
    const classId = 'c3333333-3333-3333-3333-333333333333';
    const sampleClass = {
      id: classId,
      class_name: 'Computer Engineering',
      subject: 'Computer Networks',
      semester: '5',
      division: 'A',
      teacher_id: teacherId,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // 4. Sample Students
    const sampleStudents = [
      {
        id: 'd4444444-4444-4444-4444-444444444401',
        enrollment_number: 'EN2024CS001',
        full_name: 'Alice Sharma',
        email: 'alice@student.college.edu',
        phone_number: '+1-555-0201',
        password_hash: studentHash,
        class_id: classId,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'd4444444-4444-4444-4444-444444444402',
        enrollment_number: 'EN2024CS002',
        full_name: 'Bob Patel',
        email: 'bob@student.college.edu',
        phone_number: '+1-555-0202',
        password_hash: studentHash,
        class_id: classId,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'd4444444-4444-4444-4444-444444444403',
        enrollment_number: 'EN2024CS003',
        full_name: 'Charlie Singh',
        email: 'charlie@student.college.edu',
        phone_number: '+1-555-0203',
        password_hash: studentHash,
        class_id: classId,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'd4444444-4444-4444-4444-444444444404',
        enrollment_number: 'EN2024CS004',
        full_name: 'Diana D\'Souza',
        email: 'diana@student.college.edu',
        phone_number: '+1-555-0204',
        password_hash: studentHash,
        class_id: classId,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'd4444444-4444-4444-4444-444444444405',
        enrollment_number: 'EN2024CS005',
        full_name: 'Ethan Hunt',
        email: 'ethan@student.college.edu',
        phone_number: '+1-555-0205',
        password_hash: studentHash,
        class_id: classId,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    // 5. ESP32 Classroom Attendance Device
    const esp32DeviceId = 'e5555555-5555-5555-5555-555555555555';
    const sampleDevice = {
      id: esp32DeviceId,
      esp32_id: 'CLASSROOM_01',
      device_name: 'ESP32 Lab Node 1',
      classroom_id: 'ROOM_302',
      service_uuid: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
      char_challenge_uuid: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
      char_response_uuid: 'beb5483f-36e1-4688-b7f5-ea07361b26a9',
      secret_key: 'E9B489601E852DDE34B76AE93D8967484B6F3E103E9946C3AE852DDE34B76AE9',
      device_status: 'active',
      firmware_version: '1.0.0',
      last_seen_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    // 6. Active Attendance Session for testing
    const sessionId = 'f6666666-6666-6666-6666-666666666666';
    const startTime = new Date();
    const endTime = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes active
    const sampleSession = {
      id: sessionId,
      class_id: classId,
      esp32_id: esp32DeviceId,
      session_name: 'Lecture 14 - Routing Protocols (OSPF & BGP)',
      start_time: startTime,
      end_time: endTime,
      status: 'active',
      created_by: teacherId,
      created_at: new Date(),
    };

    // Clean In-Memory store for production
    mockStore.users = [adminUser, teacherUser];
    mockStore.classes = [];
    mockStore.students = [];
    mockStore.esp32_devices = [];
    mockStore.attendance_sessions = [];
    mockStore.attendance_records = [];
    mockStore.challenge_nonces = [];

    // If connected to Neon DB, execute schema and seed upserts
    const pool = getDbPool();
    if (pool) {
      try {
        console.log('[DB Seed] Applying PostgreSQL schema & demo seeds to Neon...');
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
          await pool.query(schemaSql);
          console.log('✅ [DB Seed] Tables & indexes created on Neon PostgreSQL.');
        }
        // Insert default admin if not exists
        await pool.query(
          `INSERT INTO users (id, full_name, email, phone_number, password_hash, role, department)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (email) DO NOTHING`,
          [adminUser.id, adminUser.full_name, adminUser.email, adminUser.phone_number, adminUser.password_hash, adminUser.role, adminUser.department]
        );

        // Insert default teacher if not exists
        await pool.query(
          `INSERT INTO users (id, full_name, email, phone_number, password_hash, role, department)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (email) DO NOTHING`,
          [teacherUser.id, teacherUser.full_name, teacherUser.email, teacherUser.phone_number, teacherUser.password_hash, teacherUser.role, teacherUser.department]
        );

        // Provision 3 Fixed Auditorium Devices
        const audiDevices = [
          { id: 'e1111111-1111-1111-1111-111111111101', esp32_id: 'AUDITORIUM_01', name: 'Auditorium 1 Presence Node', room: 'AUDITORIUM_1', uuid: '4fafc201-1fb5-459e-8fcc-c5c9c3319141', key: 'A1B2C3D4E5F601020304050607080910A1B2C3D4E5F601020304050607080911' },
          { id: 'e1111111-1111-1111-1111-111111111102', esp32_id: 'AUDITORIUM_02', name: 'Auditorium 2 Presence Node', room: 'AUDITORIUM_2', uuid: '4fafc201-1fb5-459e-8fcc-c5c9c3319142', key: 'A1B2C3D4E5F601020304050607080910A1B2C3D4E5F601020304050607080912' },
          { id: 'e1111111-1111-1111-1111-111111111103', esp32_id: 'AUDITORIUM_03', name: 'Auditorium 3 Presence Node', room: 'AUDITORIUM_3', uuid: '4fafc201-1fb5-459e-8fcc-c5c9c3319143', key: 'A1B2C3D4E5F601020304050607080910A1B2C3D4E5F601020304050607080913' },
        ];
        for (const ad of audiDevices) {
          await pool.query(
            `INSERT INTO esp32_devices (id, esp32_id, device_name, classroom_id, service_uuid, char_challenge_uuid, char_response_uuid, secret_key, device_status, firmware_version)
             VALUES ($1, $2, $3, $4, $5, 'beb5483e-36e1-4688-b7f5-ea07361b26a8', 'beb5483f-36e1-4688-b7f5-ea07361b26a9', $6, 'active', '1.0.0')
             ON CONFLICT (esp32_id) DO NOTHING`,
            [ad.id, ad.esp32_id, ad.name, ad.room, ad.uuid, ad.key]
          );
        }

        console.log('✅ [DB Init] Neon PostgreSQL tables, core staff accounts, and 3 Auditorium nodes verified.');
      } catch (dbErr: any) {
        console.warn('Notice: Remote Neon initialization notice:', dbErr.message);
      }
    }

    console.log('✅ System ready for production:');
    console.log('   - Admin:   admin@college.edu   / Admin@123');
    console.log('   - Teacher: teacher@college.edu / Teacher@123');
    console.log('   - Students: Managed directly via Dashboard');
  } catch (err: any) {
    console.error('[DB Seed] Error:', err);
  }
}

// Run standalone if executed directly
if (process.argv[1]?.endsWith('initDb.ts')) {
  seedDatabase().then(() => {
    console.log('Database initialization routine finished.');
    process.exit(0);
  });
}
