import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/db.js';

const classSchema = z.object({
  className: z.string().min(2, 'Class name is required'),
  subject: z.string().min(2, 'Course/Subject is required'),
  semester: z.string().min(1, 'Semester is required'),
  division: z.string().min(1, 'Division/Section is required'),
  teacherId: z.string().uuid().optional().nullable(),
});

export class ClassController {
  /**
   * List all classes with student count and teacher details
   */
  static async getClasses(req: Request, res: Response): Promise<void> {
    try {
      const result = await query(
        `SELECT c.*, u.full_name as teacher_name, u.email as teacher_email,
                COUNT(s.id)::int as student_count
         FROM classes c
         LEFT JOIN users u ON c.teacher_id = u.id
         LEFT JOIN students s ON s.class_id = c.id
         GROUP BY c.id, u.full_name, u.email
         ORDER BY c.class_name ASC, c.division ASC`
      );

      res.status(200).json({
        success: true,
        classes: result.rows || [],
      });
    } catch (err: any) {
      console.error('[ClassController.getClasses]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Get single class with enrolled students
   */
  static async getClassById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const classRes = await query(
        `SELECT c.*, u.full_name as teacher_name, u.email as teacher_email
         FROM classes c
         LEFT JOIN users u ON c.teacher_id = u.id
         WHERE c.id = $1`,
        [id]
      );

      if (!classRes.rows || classRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Class not found' });
        return;
      }

      const studentsRes = await query(
        `SELECT id, enrollment_number, full_name, division, roll_number, group_name, email, phone_number, status, created_at
         FROM students
         WHERE class_id = $1
         ORDER BY COALESCE(group_name, '') ASC, COALESCE(division, '') ASC, NULLIF(regexp_replace(COALESCE(roll_number, '0'), '\\D', '', 'g'), '')::INTEGER ASC NULLS LAST, roll_number ASC`,
        [id]
      );

      res.status(200).json({
        success: true,
        classData: classRes.rows[0],
        students: studentsRes.rows || [],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Create new class
   */
  static async createClass(req: Request, res: Response): Promise<void> {
    try {
      const parsed = classSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.format(),
        });
        return;
      }

      const { className, subject, semester, division, teacherId } = parsed.data;
      const id = crypto.randomUUID();
      const assignedTeacherId = teacherId || (req.user?.role === 'teacher' ? req.user.id : null);

      const result = await query(
        `INSERT INTO classes (id, class_name, subject, semester, division, teacher_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [id, className, subject, semester, division, assignedTeacherId]
      );

      res.status(201).json({
        success: true,
        message: 'Class created successfully',
        classData: result.rows[0],
      });
    } catch (err: any) {
      console.error('[ClassController.createClass]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Update class
   */
  static async updateClass(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = classSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'VALIDATION_ERROR', details: parsed.error.format() });
        return;
      }

      const { className, subject, semester, division, teacherId } = parsed.data;
      const result = await query(
        `UPDATE classes
         SET class_name = $1, subject = $2, semester = $3, division = $4, teacher_id = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [className, subject, semester, division, teacherId || null, id]
      );

      if (!result.rows || result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Class not found' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Class updated successfully',
        classData: result.rows[0],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Delete class
   */
  static async deleteClass(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await query('DELETE FROM classes WHERE id = $1', [id]);
      res.status(200).json({ success: true, message: 'Class deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }
}
