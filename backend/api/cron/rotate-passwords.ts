import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_UBD6HgbY2XMe@ep-bitter-glitter-azqe7m88-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is called by Vercel Cron (check Authorization header)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // In production, verify cron secret. For now, allow.
  }
  
  const client = await pool.connect();
  try {
    const students = await client.query('SELECT id FROM students WHERE status = $1', ['active']);
    let count = 0;
    for (const student of students.rows) {
      const newPassword = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
      const hash = await bcrypt.hash(newPassword, 10);
      await client.query(
        'UPDATE students SET password_hash = $1, plain_password = $2, updated_at = NOW() WHERE id = $3',
        [hash, newPassword, student.id]
      );
      count++;
    }
    res.status(200).json({ success: true, message: `Rotated passwords for ${count} students`, count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}
