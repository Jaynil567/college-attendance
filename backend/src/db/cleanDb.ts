import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDbPool } from '../config/db.js';

async function resetDbForProduction() {
  console.log('========================================================');
  console.log('🧹 CLEANING DATABASE FOR ONLINE PRODUCTION DEPLOYMENT');
  console.log('========================================================');

  const pool = getDbPool();
  if (!pool) {
    console.error('Error: Could not connect to Neon PostgreSQL database.');
    process.exit(1);
  }

  try {
    // 1. Truncate all child and operational tables
    console.log('1. Clearing dummy attendance logs, nonces, sessions, students, and classes...');
    await pool.query('TRUNCATE TABLE challenge_nonces CASCADE');
    await pool.query('TRUNCATE TABLE attendance_records CASCADE');
    await pool.query('TRUNCATE TABLE attendance_sessions CASCADE');
    await pool.query('TRUNCATE TABLE students CASCADE');
    await pool.query('TRUNCATE TABLE classes CASCADE');
    await pool.query('TRUNCATE TABLE esp32_devices CASCADE');
    await pool.query('TRUNCATE TABLE users CASCADE');

    console.log('2. Generating secure password hashes for staff accounts...');
    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('Admin@123', salt);
    const teacherHash = await bcrypt.hash('Teacher@123', salt);

    // 3. Insert Admin account
    const adminId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, full_name, email, phone_number, password_hash, role, department, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'admin', 'Administration', NOW(), NOW())`,
      [adminId, 'College Administrator', 'admin@college.edu', '+1-555-0001', adminHash]
    );
    console.log('✅ Admin account created:   admin@college.edu   / Admin@123');

    // 4. Insert Teacher account
    const teacherId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, full_name, email, phone_number, password_hash, role, department, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'teacher', 'Engineering Faculty', NOW(), NOW())`,
      [teacherId, 'Head Professor', 'teacher@college.edu', '+1-555-0002', teacherHash]
    );
    console.log('✅ Teacher account created: teacher@college.edu / Teacher@123');

    // 5. Verify database counts
    const userCount = await pool.query('SELECT count(*)::int as count FROM users');
    const studentCount = await pool.query('SELECT count(*)::int as count FROM students');
    const classCount = await pool.query('SELECT count(*)::int as count FROM classes');
    const recordsCount = await pool.query('SELECT count(*)::int as count FROM attendance_records');

    console.log('\n--- Current Production Database State ---');
    console.log(`Users (Staff):        ${userCount.rows[0].count} (1 Admin, 1 Teacher)`);
    console.log(`Students:             ${studentCount.rows[0].count} (Fresh & Empty)`);
    console.log(`Classes:              ${classCount.rows[0].count} (Fresh & Empty)`);
    console.log(`Attendance Records:   ${recordsCount.rows[0].count} (Fresh & Empty)`);
    console.log('========================================================');
    console.log('🚀 Neon Database is clean and ready for real production!');
    console.log('========================================================');

    process.exit(0);
  } catch (err: any) {
    console.error('Database clean error:', err);
    process.exit(1);
  }
}

resetDbForProduction();
