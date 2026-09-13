import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_classroom_jwt_attendance_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CHALLENGE_EXPIRY_SECONDS: parseInt(process.env.CHALLENGE_EXPIRY_SECONDS || '120', 10),
  MAX_CLOCK_DRIFT_SECONDS: parseInt(process.env.MAX_CLOCK_DRIFT_SECONDS || '60', 10),
  MIN_RSSI_DBM: parseInt(process.env.MIN_RSSI_DBM || '-85', 10),
  DEFAULT_SESSION_DURATION_MINUTES: parseInt(process.env.DEFAULT_SESSION_DURATION_MINUTES || '45', 10),
};
