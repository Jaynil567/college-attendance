import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/db.js';

const teacherCreateSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
  department: z.string().optional().default('General Engineering'),
  phoneNumber: z.string().optional().nullable(),
});

const teacherUpdateSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(4).optional(),
  department: z.string().optional(),
  phoneNumber: z.string().optional().nullable(),
});

export class TeacherController {
  /**
   * List all teachers (Admin only)
   */
  static async getTeachers(req: Request, res: Response): Promise<void> {
    try {
      const result = await query(
        `SELECT id, full_name, email, phone_number, role, department, created_at, updated_at
         FROM users
         WHERE role = 'teacher'
         ORDER BY created_at DESC`
      );
      res.status(200).json({
        success: true,
        count: result.rows.length,
        teachers: result.rows || [],
      });
    } catch (err: any) {
      console.error('[TeacherController.getTeachers]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Create a new teacher (Admin only)
   */
  static async createTeacher(req: Request, res: Response): Promise<void> {
    try {
      const parsed = teacherCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.format(),
        });
        return;
      }

      const { fullName, email, password, department, phoneNumber } = parsed.data;
      const cleanEmail = email.trim().toLowerCase();

      // Check existing email
      const existing = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
      if (existing.rows && existing.rows.length > 0) {
        res.status(409).json({
          success: false,
          error: 'EMAIL_EXISTS',
          message: `User with email '${cleanEmail}' already exists.`,
        });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      const newId = crypto.randomUUID();

      await query(
        `INSERT INTO users (id, full_name, email, phone_number, password_hash, role, department, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'teacher', $6, NOW(), NOW())`,
        [newId, fullName.trim(), cleanEmail, phoneNumber || null, hash, department]
      );

      res.status(201).json({
        success: true,
        message: 'Teacher account created successfully.',
        teacher: {
          id: newId,
          fullName: fullName.trim(),
          email: cleanEmail,
          department,
          phoneNumber,
        },
      });
    } catch (err: any) {
      console.error('[TeacherController.createTeacher]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Update teacher details or password (Admin only)
   */
  static async updateTeacher(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = teacherUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.format(),
        });
        return;
      }

      const fields = parsed.data;
      const setClauses: string[] = [];
      const values: any[] = [];

      if (fields.fullName) {
        values.push(fields.fullName.trim());
        setClauses.push(`full_name = $${values.length}`);
      }
      if (fields.email) {
        values.push(fields.email.trim().toLowerCase());
        setClauses.push(`email = $${values.length}`);
      }
      if (fields.department !== undefined) {
        values.push(fields.department);
        setClauses.push(`department = $${values.length}`);
      }
      if (fields.phoneNumber !== undefined) {
        values.push(fields.phoneNumber);
        setClauses.push(`phone_number = $${values.length}`);
      }
      if (fields.password) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(fields.password, salt);
        values.push(hash);
        setClauses.push(`password_hash = $${values.length}`);
      }

      if (setClauses.length === 0) {
        res.status(400).json({ success: false, message: 'No fields provided for update.' });
        return;
      }

      setClauses.push('updated_at = NOW()');
      values.push(id);

      const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${values.length} AND role = 'teacher' RETURNING id, full_name, email, department, phone_number`;
      const result = await query(sql, values);

      if (!result.rows || result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'TEACHER_NOT_FOUND', message: 'Teacher not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Teacher updated successfully.',
        teacher: result.rows[0],
      });
    } catch (err: any) {
      console.error('[TeacherController.updateTeacher]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Delete a teacher (Admin only)
   */
  static async deleteTeacher(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await query(`DELETE FROM users WHERE id = $1 AND role = 'teacher' RETURNING id`, [id]);
      if (!result.rows || result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'TEACHER_NOT_FOUND', message: 'Teacher not found.' });
        return;
      }
      res.status(200).json({ success: true, message: 'Teacher account deleted successfully.' });
    } catch (err: any) {
      console.error('[TeacherController.deleteTeacher]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }
}
