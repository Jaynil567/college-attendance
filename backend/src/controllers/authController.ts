import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../config/db.js';
import { generateToken } from '../middleware/auth.js';

// Schemas for input validation
const teacherLoginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const studentLoginSchema = z.object({
  enrollmentNumber: z.string().min(3, 'Enrollment number is required'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

export class AuthController {
  /**
   * Teacher / Administrator Login
   */
  static async teacherLogin(req: Request, res: Response): Promise<void> {
    try {
      const parsed = teacherLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.format(),
        });
        return;
      }

      const { email, password } = parsed.data;
      const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

      if (!result.rows || result.rows.length === 0) {
        res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid teacher/admin email or password.',
        });
        return;
      }

      const user = result.rows[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid teacher/admin email or password.',
        });
        return;
      }

      const token = generateToken({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          department: user.department,
        },
      });
    } catch (err: any) {
      console.error('[AuthController.teacherLogin]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Student Login (Via unique enrollment number)
   */
  static async studentLogin(req: Request, res: Response): Promise<void> {
    try {
      const parsed = studentLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.format(),
        });
        return;
      }

      const { enrollmentNumber, password } = parsed.data;
      const cleanEnrollment = enrollmentNumber.trim().toUpperCase();

      const result = await query(
        `SELECT s.*, c.class_name, c.subject, c.semester, c.division
         FROM students s
         LEFT JOIN classes c ON s.class_id = c.id
         WHERE s.enrollment_number = $1`,
        [cleanEnrollment]
      );

      if (!result.rows || result.rows.length === 0) {
        res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Enrollment number not registered. Contact your teacher or admin.',
        });
        return;
      }

      const student = result.rows[0];

      if (student.status !== 'active') {
        res.status(403).json({
          success: false,
          error: 'ACCOUNT_INACTIVE',
          message: 'Your student account is currently deactivated. Please contact your department admin.',
        });
        return;
      }

      const isMatch = await bcrypt.compare(password, student.password_hash);
      if (!isMatch) {
        res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid enrollment number or password.',
        });
        return;
      }

      const token = generateToken({
        id: student.id,
        enrollmentNumber: student.enrollment_number,
        fullName: student.full_name,
        role: 'student',
        classId: student.class_id,
      });

      res.status(200).json({
        success: true,
        message: 'Student login successful',
        token,
        student: {
          id: student.id,
          enrollmentNumber: student.enrollment_number,
          fullName: student.full_name,
          email: student.email,
          phoneNumber: student.phone_number,
          classId: student.class_id,
          className: student.class_name,
          subject: student.subject,
          semester: student.semester,
          division: student.division,
          status: student.status,
        },
      });
    } catch (err: any) {
      console.error('[AuthController.studentLogin]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Get Current Authenticated User / Student profile
   */
  static async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
        return;
      }

      if (req.user.role === 'student') {
        const result = await query(
          `SELECT s.id, s.enrollment_number, s.full_name, s.email, s.phone_number, s.status,
                  c.id as class_id, c.class_name, c.subject, c.semester, c.division
           FROM students s
           LEFT JOIN classes c ON s.class_id = c.id
           WHERE s.id = $1`,
          [req.user.id]
        );
        res.status(200).json({ success: true, user: result.rows[0], role: 'student' });
        return;
      }

      // Teacher / Admin
      const result = await query(
        `SELECT id, full_name, email, phone_number, role, department
         FROM users WHERE id = $1`,
        [req.user.id]
      );
      if (!result.rows || result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
        return;
      }
      const u = result.rows[0];
      res.status(200).json({
        success: true,
        user: {
          id: u.id,
          fullName: u.full_name,
          full_name: u.full_name,
          email: u.email,
          phoneNumber: u.phone_number,
          role: u.role,
          department: u.department,
        },
        role: req.user.role,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }
}
