import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/db.js';

const studentCreateSchema = z.object({
  enrollmentNumber: z.string().min(3, 'Enrollment number is required'),
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  password: z.string().min(4, 'Password must be at least 4 characters').default('student123'),
  classId: z.string().uuid('Valid Class ID is required').optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const studentUpdateSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  password: z.string().min(4).optional(),
  classId: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

export class StudentController {
  /**
   * Register a new student (Teacher/Admin only; self-registration is blocked)
   */
  static async createStudent(req: Request, res: Response): Promise<void> {
    try {
      const parsed = studentCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.format(),
        });
        return;
      }

      const { enrollmentNumber, fullName, email, phoneNumber, password, classId, status } = parsed.data;
      const cleanEnrollment = enrollmentNumber.trim().toUpperCase();

      // Check for existing enrollment number
      const existing = await query(
        'SELECT id FROM students WHERE enrollment_number = $1',
        [cleanEnrollment]
      );
      if (existing.rows && existing.rows.length > 0) {
        res.status(409).json({
          success: false,
          error: 'ENROLLMENT_EXISTS',
          message: `Student with enrollment number '${cleanEnrollment}' already exists.`,
        });
        return;
      }

      // Hash default or provided password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password || 'student123', salt);
      const studentId = crypto.randomUUID();

      const result = await query(
        `INSERT INTO students (id, enrollment_number, full_name, email, phone_number, password_hash, class_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING id, enrollment_number, full_name, email, phone_number, class_id, status, created_at`,
        [studentId, cleanEnrollment, fullName.trim(), email?.trim() || null, phoneNumber?.trim() || null, passwordHash, classId || null, status]
      );

      res.status(201).json({
        success: true,
        message: 'Student registered successfully',
        student: result.rows[0],
      });
    } catch (err: any) {
      console.error('[StudentController.createStudent]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Get all students with search and filtering
   */
  static async getStudents(req: Request, res: Response): Promise<void> {
    try {
      const { search, classId, status } = req.query;

      let sql = `
        SELECT s.id, s.enrollment_number, s.full_name, s.email, s.phone_number,
               s.status, s.created_at, s.updated_at,
               c.id as class_id, c.class_name, c.subject, c.semester, c.division
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (search && typeof search === 'string' && search.trim() !== '') {
        params.push(`%${search.trim().toUpperCase()}%`);
        sql += ` AND (UPPER(s.enrollment_number) LIKE $${params.length} OR UPPER(s.full_name) LIKE $${params.length})`;
      }

      if (classId && typeof classId === 'string' && classId.trim() !== '') {
        params.push(classId.trim());
        sql += ` AND s.class_id = $${params.length}`;
      }

      if (status && (status === 'active' || status === 'inactive')) {
        params.push(status);
        sql += ` AND s.status = $${params.length}`;
      }

      sql += ` ORDER BY s.enrollment_number ASC`;

      const result = await query(sql, params);
      res.status(200).json({
        success: true,
        count: result.rows.length,
        students: result.rows || [],
      });
    } catch (err: any) {
      console.error('[StudentController.getStudents]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Get single student by ID with attendance statistics
   */
  static async getStudentById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const studentRes = await query(
        `SELECT s.id, s.enrollment_number, s.full_name, s.email, s.phone_number,
                s.status, s.created_at,
                c.id as class_id, c.class_name, c.subject, c.semester, c.division
         FROM students s
         LEFT JOIN classes c ON s.class_id = c.id
         WHERE s.id = $1`,
        [id]
      );

      if (!studentRes.rows || studentRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Student not found' });
        return;
      }

      const attendanceRes = await query(
        `SELECT COUNT(*)::int as total_sessions,
                COUNT(CASE WHEN status = 'present' THEN 1 END)::int as present_count
         FROM attendance_records
         WHERE student_id = $1`,
        [id]
      );

      const stats = attendanceRes.rows[0] || { total_sessions: 0, present_count: 0 };
      const percentage = stats.total_sessions > 0
        ? Math.round((stats.present_count / stats.total_sessions) * 100)
        : 0;

      res.status(200).json({
        success: true,
        student: studentRes.rows[0],
        attendanceStats: {
          totalSessions: stats.total_sessions,
          presentCount: stats.present_count,
          percentage,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Update student information
   */
  static async updateStudent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = studentUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'VALIDATION_ERROR', details: parsed.error.format() });
        return;
      }

      const { fullName, email, phoneNumber, password, classId, status } = parsed.data;

      // Build dynamic update
      const updates: string[] = ['updated_at = NOW()'];
      const params: any[] = [];

      if (fullName) {
        params.push(fullName.trim());
        updates.push(`full_name = $${params.length}`);
      }
      if (email !== undefined) {
        params.push(email ? email.trim() : null);
        updates.push(`email = $${params.length}`);
      }
      if (phoneNumber !== undefined) {
        params.push(phoneNumber ? phoneNumber.trim() : null);
        updates.push(`phone_number = $${params.length}`);
      }
      if (classId !== undefined) {
        params.push(classId || null);
        updates.push(`class_id = $${params.length}`);
      }
      if (status !== undefined) {
        params.push(status);
        updates.push(`status = $${params.length}`);
      }
      if (password) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        params.push(hash);
        updates.push(`password_hash = $${params.length}`);
      }

      params.push(id);
      const sql = `UPDATE students SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, enrollment_number, full_name, email, phone_number, class_id, status, updated_at`;

      const result = await query(sql, params);
      if (!result.rows || result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Student not found' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Student updated successfully',
        student: result.rows[0],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Delete or deactivate student
   */
  static async deleteStudent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await query('DELETE FROM students WHERE id = $1', [id]);
      res.status(200).json({ success: true, message: 'Student deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }
}
