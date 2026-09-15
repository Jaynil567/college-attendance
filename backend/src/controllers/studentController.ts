import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/db.js';

const studentCreateSchema = z.object({
  enrollmentNumber: z.string().min(3, 'Enrollment number is required'),
  fullName: z.string().min(2, 'Full name is required'),
  division: z.string().optional().nullable(),
  rollNumber: z.string().optional().nullable(),
  groupName: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  password: z.string().min(4, 'Password must be at least 4 characters').default('student123'),
  classId: z.string().uuid('Valid Class ID is required').optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const studentUpdateSchema = z.object({
  fullName: z.string().min(2).optional(),
  division: z.string().optional().nullable(),
  rollNumber: z.string().optional().nullable(),
  groupName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  password: z.string().min(4).optional(),
  classId: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
  device_id: z.string().optional().nullable(),
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

      const { enrollmentNumber, fullName, division, rollNumber, groupName, email, phoneNumber, password, classId, status } = parsed.data;
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
      const studentPassword = password || 'student123';
      const passwordHash = await bcrypt.hash(studentPassword, salt);
      const studentId = crypto.randomUUID();

      const result = await query(
        `INSERT INTO students (id, enrollment_number, full_name, division, roll_number, group_name, email, phone_number, password_hash, plain_password, class_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         RETURNING id, enrollment_number, full_name, division, roll_number, group_name, email, phone_number, plain_password, class_id, status, created_at`,
        [studentId, cleanEnrollment, fullName.trim(), division?.trim() || null, rollNumber?.trim() || null, groupName?.trim() || null, email?.trim() || null, phoneNumber?.trim() || null, passwordHash, studentPassword, classId || null, status]
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
      const { search, classId, status, division, groupName, group } = req.query;

      let sql = `
        SELECT s.id, s.enrollment_number, s.full_name, s.division, s.roll_number, s.group_name,
               s.email, s.phone_number, s.plain_password, s.status, s.device_id, s.created_at, s.updated_at,
               c.id as class_id, c.class_name, c.subject, c.semester
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (search && typeof search === 'string' && search.trim() !== '') {
        params.push(`%${search.trim().toUpperCase()}%`);
        sql += ` AND (UPPER(s.enrollment_number) LIKE $${params.length} OR UPPER(s.full_name) LIKE $${params.length} OR UPPER(COALESCE(s.division, '')) LIKE $${params.length} OR UPPER(COALESCE(s.group_name, '')) LIKE $${params.length})`;
      }

      if (classId && typeof classId === 'string' && classId.trim() !== '') {
        params.push(classId.trim());
        sql += ` AND s.class_id = $${params.length}`;
      }

      if (status && (status === 'active' || status === 'inactive')) {
        params.push(status);
        sql += ` AND s.status = $${params.length}`;
      }

      if (division && typeof division === 'string' && division.trim() !== '') {
        params.push(division.trim());
        sql += ` AND s.division = $${params.length}`;
      }

      const targetGroup = groupName || group;
      if (targetGroup && typeof targetGroup === 'string' && targetGroup.trim() !== '') {
        params.push(targetGroup.trim());
        sql += ` AND s.group_name = $${params.length}`;
      }

      sql += ` ORDER BY COALESCE(s.group_name, '') ASC, COALESCE(s.division, '') ASC, NULLIF(regexp_replace(COALESCE(s.roll_number, '0'), '\\D', '', 'g'), '')::INTEGER ASC NULLS LAST, s.roll_number ASC`;

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
        `SELECT s.id, s.enrollment_number, s.full_name, s.division, s.roll_number, s.group_name, s.email, s.phone_number,
                s.plain_password, s.status, s.created_at,
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

      const { fullName, division, rollNumber, groupName, email, phoneNumber, password, classId, status } = parsed.data;

      // Build dynamic update
      const updates: string[] = ['updated_at = NOW()'];
      const params: any[] = [];

      if (fullName) {
        params.push(fullName.trim());
        updates.push(`full_name = $${params.length}`);
      }
      if (division !== undefined) {
        params.push(division ? division.trim() : null);
        updates.push(`division = $${params.length}`);
      }
      if (rollNumber !== undefined) {
        params.push(rollNumber ? rollNumber.trim() : null);
        updates.push(`roll_number = $${params.length}`);
      }
      if (groupName !== undefined) {
        params.push(groupName ? groupName.trim() : null);
        updates.push(`group_name = $${params.length}`);
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
      if (req.body.device_id !== undefined) {
        params.push(req.body.device_id);
        updates.push(`device_id = $${params.length}`);
      }
      if (password) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        params.push(hash);
        updates.push(`password_hash = $${params.length}`);
        params.push(password);
        updates.push(`plain_password = $${params.length}`);
      }

      params.push(id);
      const sql = `UPDATE students SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, enrollment_number, full_name, division, roll_number, group_name, email, phone_number, plain_password, class_id, status, updated_at`;

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

  /**
   * Reset all student passwords to a random 4-digit code (Optimized Bulk Execution)
   */
  static async resetAllPasswords(req: Request, res: Response): Promise<void> {
    try {
      const students = await query('SELECT id FROM students WHERE status = $1', ['active']);
      const studentRows = students.rows || [];
      const total = studentRows.length;
      if (total === 0) {
        res.status(200).json({ success: true, count: 0, message: 'No active students to rotate' });
        return;
      }

      const chunkSize = 50;
      let count = 0;

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = studentRows.slice(i, i + chunkSize);
        const processed = await Promise.all(
          chunk.map(async (student: any) => {
            const newPassword = String(Math.floor(1000 + Math.random() * 9000));
            const hash = await bcrypt.hash(newPassword, 8);
            return { id: student.id, newPassword, hash };
          })
        );

        const hashCases = processed.map((p) => `WHEN id = '${p.id}' THEN '${p.hash}'`).join(' ');
        const plainCases = processed.map((p) => `WHEN id = '${p.id}' THEN '${p.newPassword}'`).join(' ');
        const idList = processed.map((p) => `'${p.id}'`).join(',');

        const updateSql = `
          UPDATE students 
          SET password_hash = CASE ${hashCases} END,
              plain_password = CASE ${plainCases} END,
              updated_at = NOW()
          WHERE id IN (${idList})
        `;

        await query(updateSql);
        count += processed.length;
      }

      console.log(`[StudentController.resetAllPasswords] Rotated passwords for ${count} students successfully.`);
      res.status(200).json({ success: true, count, message: `Rotated passwords for ${count} students` });
    } catch (err: any) {
      console.error('[StudentController.resetAllPasswords]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Export all student credentials to an Excel file
   */
  static async exportCredentials(req: Request, res: Response): Promise<void> {
    try {
      const { division, groupName, group, search } = req.query;

      let sql = `SELECT enrollment_number, full_name, division, roll_number, group_name, plain_password FROM students WHERE 1=1`;
      const params: any[] = [];

      if (search && typeof search === 'string' && search.trim() !== '') {
        params.push(`%${search.trim().toUpperCase()}%`);
        sql += ` AND (UPPER(enrollment_number) LIKE $${params.length} OR UPPER(full_name) LIKE $${params.length})`;
      }

      if (division && typeof division === 'string' && division.trim() !== '') {
        params.push(division.trim());
        sql += ` AND division = $${params.length}`;
      }

      const targetGroup = groupName || group;
      if (targetGroup && typeof targetGroup === 'string' && targetGroup.trim() !== '') {
        params.push(targetGroup.trim());
        sql += ` AND group_name = $${params.length}`;
      }

      sql += ` ORDER BY COALESCE(group_name, '') ASC, COALESCE(division, '') ASC, NULLIF(regexp_replace(COALESCE(roll_number, '0'), '\\D', '', 'g'), '')::INTEGER ASC NULLS LAST, roll_number ASC`;

      const result = await query(sql, params);

      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Student Details');

      worksheet.columns = [
        { header: 'Sr. No', key: 'srNo', width: 8 },
        { header: 'Group', key: 'group', width: 12 },
        { header: 'Division', key: 'division', width: 12 },
        { header: 'Roll Number', key: 'rollNumber', width: 14 },
        { header: 'Enrollment Number', key: 'enrollment', width: 22 },
        { header: 'Name Of Student', key: 'name', width: 32 },
        { header: 'Password', key: 'password', width: 14 },
      ];

      result.rows.forEach((student: any, index: number) => {
        worksheet.addRow({
          srNo: index + 1,
          group: student.group_name || 'N/A',
          division: student.division || 'N/A',
          rollNumber: student.roll_number || 'N/A',
          enrollment: student.enrollment_number,
          name: student.full_name,
          password: student.plain_password,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `Student_Details_${new Date().toISOString().slice(0, 10)}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err: any) {
      console.error('[StudentController.exportCredentials]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Export student credentials as print-ready PDF
   */
  static async exportCredentialsPdf(req: Request, res: Response): Promise<void> {
    try {
      const { division, groupName, group, search } = req.query;

      let sql = `SELECT enrollment_number, full_name, division, roll_number, group_name, plain_password FROM students WHERE 1=1`;
      const params: any[] = [];

      if (search && typeof search === 'string' && search.trim() !== '') {
        params.push(`%${search.trim().toUpperCase()}%`);
        sql += ` AND (UPPER(enrollment_number) LIKE $${params.length} OR UPPER(full_name) LIKE $${params.length})`;
      }

      if (division && typeof division === 'string' && division.trim() !== '') {
        params.push(division.trim());
        sql += ` AND division = $${params.length}`;
      }

      const targetGroup = groupName || group;
      if (targetGroup && typeof targetGroup === 'string' && targetGroup.trim() !== '') {
        params.push(targetGroup.trim());
        sql += ` AND group_name = $${params.length}`;
      }

      sql += ` ORDER BY COALESCE(group_name, '') ASC, COALESCE(division, '') ASC, NULLIF(regexp_replace(COALESCE(roll_number, '0'), '\\D', '', 'g'), '')::INTEGER ASC NULLS LAST, roll_number ASC`;

      const result = await query(sql, params);

      const rows = (result.rows || []).map((st: any, idx: number) => ({
        srNo: idx + 1,
        group: st.group_name || 'N/A',
        division: st.division || 'N/A',
        rollNumber: st.roll_number || 'N/A',
        enrollment: st.enrollment_number,
        name: st.full_name,
        password: st.plain_password || 'N/A',
      }));

      const { PdfService } = await import('../services/pdfService.js');
      const pdfBuffer = await PdfService.generateCredentialsPdf(rows);

      const filename = `Student_Credentials_${new Date().toISOString().slice(0, 10)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error('[StudentController.exportCredentialsPdf]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }
}
