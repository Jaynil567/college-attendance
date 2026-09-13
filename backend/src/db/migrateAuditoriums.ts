import bcrypt from 'bcryptjs';
import { getDbPool } from '../config/db.js';

async function migrate() {
  console.log('Starting migration for 3-Auditorium College Attendance System...');
  const pool = getDbPool();
  if (!pool) {
    console.error('Could not get DB pool');
    process.exit(1);
  }
  
  // 1. Students table updates
  await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS plain_password VARCHAR(255)');
  const defaultHash = await bcrypt.hash('student123', 10);
  await pool.query("UPDATE students SET plain_password = 'student123', password_hash = $1 WHERE plain_password IS NULL OR plain_password = 'student123'", [defaultHash]);
  console.log('✅ Added plain_password to students and synced password hashes');

  // 2. Attendance Sessions updates
  await pool.query('ALTER TABLE attendance_sessions ALTER COLUMN class_id DROP NOT NULL');
  await pool.query('ALTER TABLE attendance_sessions ALTER COLUMN end_time DROP NOT NULL');
  await pool.query('ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS auditorium_id VARCHAR(50)');
  await pool.query('ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS auditorium_name VARCHAR(100)');
  console.log('✅ Updated attendance_sessions columns');

  // 3. Attendance Records updates
  await pool.query('ALTER TABLE attendance_records ALTER COLUMN class_id DROP NOT NULL');
  console.log('✅ Updated attendance_records');

  // 4. Provision 3 Fixed Auditorium ESP32 Devices
  const devices = [
    {
      id: 'e1111111-1111-1111-1111-111111111101',
      esp32_id: 'AUDITORIUM_01',
      device_name: 'Auditorium 1 Presence Node',
      classroom_id: 'AUDITORIUM_1',
      service_uuid: '4fafc201-1fb5-459e-8fcc-c5c9c3319141',
      char_challenge_uuid: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
      char_response_uuid: 'beb5483f-36e1-4688-b7f5-ea07361b26a9',
      secret_key: 'A1B2C3D4E5F601020304050607080910A1B2C3D4E5F601020304050607080911',
    },
    {
      id: 'e1111111-1111-1111-1111-111111111102',
      esp32_id: 'AUDITORIUM_02',
      device_name: 'Auditorium 2 Presence Node',
      classroom_id: 'AUDITORIUM_2',
      service_uuid: '4fafc201-1fb5-459e-8fcc-c5c9c3319142',
      char_challenge_uuid: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
      char_response_uuid: 'beb5483f-36e1-4688-b7f5-ea07361b26a9',
      secret_key: 'A1B2C3D4E5F601020304050607080910A1B2C3D4E5F601020304050607080912',
    },
    {
      id: 'e1111111-1111-1111-1111-111111111103',
      esp32_id: 'AUDITORIUM_03',
      device_name: 'Auditorium 3 Presence Node',
      classroom_id: 'AUDITORIUM_3',
      service_uuid: '4fafc201-1fb5-459e-8fcc-c5c9c3319143',
      char_challenge_uuid: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
      char_response_uuid: 'beb5483f-36e1-4688-b7f5-ea07361b26a9',
      secret_key: 'A1B2C3D4E5F601020304050607080910A1B2C3D4E5F601020304050607080913',
    }
  ];

  for (const d of devices) {
    const insertSql = `
      INSERT INTO esp32_devices (id, esp32_id, device_name, classroom_id, service_uuid, char_challenge_uuid, char_response_uuid, secret_key, device_status, firmware_version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', '1.0.0')
      ON CONFLICT (esp32_id) DO UPDATE SET
        device_name = EXCLUDED.device_name,
        classroom_id = EXCLUDED.classroom_id,
        service_uuid = EXCLUDED.service_uuid,
        secret_key = EXCLUDED.secret_key,
        device_status = 'active'
    `;
    await pool.query(insertSql, [d.id, d.esp32_id, d.device_name, d.classroom_id, d.service_uuid, d.char_challenge_uuid, d.char_response_uuid, d.secret_key]);
    console.log('✅ Provisioned:', d.esp32_id, '(' + d.device_name + ')');
  }

  console.log('🎉 Migration finished successfully!');
  process.exit(0);
}

migrate().catch(console.error);
