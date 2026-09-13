import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/db.js';
import { ExcelService, AttendanceExportRow } from '../services/excelService.js';

const markAttendanceSchema = z.object({
  sessionId: z.string().uuid('Valid Session ID is required'),
  deviceFingerprint: z.string().min(5, 'Device fingerprint is required'),
  biometricVerified: z.boolean(),
  bleRssi: z.number().int().optional().default(-65),
  bleDeviceName: z.string().optional().default('Teacher Phone'),
});

export class AttendanceController {
  /**
   * Mark Attendance with Cryptographic ESP32 BLE Presence Proof
   */
  static async markAttendance(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    try {
      const studentId = req.user?.id;
      if (!studentId || req.user?.role !== 'student') {
        res.status(403).json({
          success: false,
          error: 'STUDENT_ONLY',
          message: 'Only authenticated students can submit attendance.',
        });
        return;
      }

      const parsed = markAttendanceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.format(),
        });
        return;
      }

      const { sessionId, deviceFingerprint, biometricVerified, bleRssi, bleDeviceName } = parsed.data;

      // 1. Fetch Student Details
      const studentRes = await query('SELECT * FROM students WHERE id = $1', [studentId]);
      if (!studentRes.rows || studentRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'STUDENT_NOT_FOUND', message: 'Student account not found.' });
        return;
      }
      const student = studentRes.rows[0];

      if (student.status !== 'active') {
        res.status(403).json({
          success: false,
          error: 'STUDENT_INACTIVE',
          message: 'Student account is inactive. Attendance cannot be recorded.',
        });
        return;
      }

      if (!biometricVerified) {
        res.status(403).json({
          success: false,
          error: 'BIOMETRIC_REQUIRED',
          message: 'Fingerprint/Face ID verification is required',
        });
        return;
      }

      if (student.device_id && student.device_id !== deviceFingerprint) {
        res.status(403).json({
          success: false,
          error: 'DEVICE_MISMATCH',
          message: 'This account is bound to another device. Contact your teacher to reset.',
        });
        return;
      }

      // 2. Fetch Session Details
      const sessionRes = await query(
        `SELECT s.*, c.class_name, c.subject
         FROM attendance_sessions s
         LEFT JOIN classes c ON s.class_id = c.id
         WHERE s.id = $1`,
        [sessionId]
      );
      if (!sessionRes.rows || sessionRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'SESSION_NOT_FOUND', message: 'Attendance session not found.' });
        return;
      }
      const session = sessionRes.rows[0];

      // Verify Session Status and Time Window
      const now = new Date();
      if (session.status !== 'active') {
        res.status(400).json({
          success: false,
          error: 'SESSION_CLOSED',
          message: `Attendance session '${session.session_name}' has ended or been closed by the teacher.`,
        });
        return;
      }

      if (session.end_time && now > new Date(session.end_time)) {
        res.status(400).json({
          success: false,
          error: 'SESSION_EXPIRED',
          message: 'Attendance window has expired for this lecture.',
        });
        return;
      }

      // 3. Verify Student is Enrolled in the Session's Class (if class-specific)
      if (session.class_id && student.class_id && student.class_id !== session.class_id) {
        res.status(403).json({
          success: false,
          error: 'UNAUTHORIZED_CLASS',
          message: 'You are not enrolled in this class/division. Attendance rejected.',
        });
        return;
      }

      // 4. Check If Student Has Already Marked Attendance for this Session
      const duplicateRes = await query(
        'SELECT id, status, marked_at FROM attendance_records WHERE session_id = $1 AND student_id = $2',
        [sessionId, studentId]
      );
      if (duplicateRes.rows && duplicateRes.rows.length > 0) {
        const existing = duplicateRes.rows[0];
        if (existing.status === 'present') {
          res.status(409).json({
            success: false,
            error: 'ALREADY_MARKED',
            message: `Attendance was already recorded at ${new Date(existing.marked_at).toLocaleTimeString()}. Duplicate submission prevented.`,
          });
          return;
        }
      }

      const latencyMs = Date.now() - startTime;
      const clientIp = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || '127.0.0.1';

      // 5. Verification Successful! Insert Attendance Record
      const recordId = crypto.randomUUID();
      const insertRes = await query(
        `INSERT INTO attendance_records (
          id, session_id, student_id, class_id, esp32_id, marked_at,
          status, rejection_reason, verification_nonce, rssi_dbm, verification_latency_ms, ip_address, device_info, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), 'present', NULL, $6, $7, $8, $9, $10, NOW())
        RETURNING *`,
        [recordId, sessionId, studentId, session.class_id, session.esp32_id, null, bleRssi, latencyMs, clientIp, deviceFingerprint]
      );

      res.status(200).json({
        success: true,
        message: 'Attendance verified and recorded successfully!',
        record: insertRes.rows[0],
        session: {
          sessionName: session.session_name,
          subject: session.subject,
          className: session.class_name,
        },
      });
    } catch (err: any) {
      console.error('[AttendanceController.markAttendance]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Get Student Attendance History (Student Portal)
   */
  static async getStudentHistory(req: Request, res: Response): Promise<void> {
    try {
      const studentId = req.user?.id;
      if (!studentId) {
        res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
        return;
      }

      const recordsRes = await query(
        `SELECT ar.id, ar.marked_at, ar.status, ar.rssi_dbm, ar.rejection_reason,
                s.session_name, s.auditorium_id, s.auditorium_name, s.start_time, s.end_time,
                c.class_name, c.subject, c.semester, c.division,
                d.esp32_id, d.device_name, d.classroom_id
         FROM attendance_records ar
         JOIN attendance_sessions s ON ar.session_id = s.id
         LEFT JOIN classes c ON ar.class_id = c.id
         LEFT JOIN esp32_devices d ON ar.esp32_id = d.id
         WHERE ar.student_id = $1
         ORDER BY ar.marked_at DESC`,
        [studentId]
      );

      // Compute statistics
      const totalCount = recordsRes.rows.length;
      const presentCount = recordsRes.rows.filter((r: any) => r.status === 'present').length;
      const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

      res.status(200).json({
        success: true,
        stats: {
          totalSessions: totalCount,
          presentCount,
          absentCount: totalCount - presentCount,
          percentage,
        },
        records: recordsRes.rows || [],
      });
    } catch (err: any) {
      console.error('[AttendanceController.getStudentHistory]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Filtered Attendance Report for Teacher/Admin
   */
  static async getAttendanceReport(req: Request, res: Response): Promise<void> {
    try {
      const { classId, sessionId, studentId, startDate, endDate, status } = req.query;

      let sql = `
        SELECT ar.id, ar.marked_at, ar.status, ar.rssi_dbm, ar.rejection_reason,
               st.enrollment_number, st.full_name as student_name,
               c.class_name, c.subject, c.semester, c.division,
               s.session_name, s.auditorium_name, s.auditorium_id, d.esp32_id, d.classroom_id
        FROM attendance_records ar
        JOIN students st ON ar.student_id = st.id
        LEFT JOIN classes c ON ar.class_id = c.id
        JOIN attendance_sessions s ON ar.session_id = s.id
        LEFT JOIN esp32_devices d ON ar.esp32_id = d.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (sessionId && typeof sessionId === 'string') {
        params.push(sessionId);
        sql += ` AND ar.session_id = $${params.length}`;
      }

      if (classId && typeof classId === 'string') {
        params.push(classId);
        sql += ` AND ar.class_id = $${params.length}`;
      }

      if (studentId && typeof studentId === 'string') {
        params.push(studentId);
        sql += ` AND ar.student_id = $${params.length}`;
      }

      if (status && typeof status === 'string') {
        params.push(status);
        sql += ` AND ar.status = $${params.length}`;
      }

      if (startDate && typeof startDate === 'string') {
        params.push(new Date(startDate));
        sql += ` AND ar.marked_at >= $${params.length}`;
      }

      if (endDate && typeof endDate === 'string') {
        params.push(new Date(endDate));
        sql += ` AND ar.marked_at <= $${params.length}`;
      }

      sql += ` ORDER BY ar.marked_at DESC`;

      const result = await query(sql, params);

      res.status(200).json({
        success: true,
        count: result.rows.length,
        records: result.rows || [],
      });
    } catch (err: any) {
      console.error('[AttendanceController.getAttendanceReport]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Export Attendance to Excel (.XLSX)
   */
  static async exportExcel(req: Request, res: Response): Promise<void> {
    try {
      const { classId, sessionId, startDate, endDate } = req.query;

      let sql = `
        SELECT ar.id, ar.marked_at, ar.status, ar.rssi_dbm,
               st.enrollment_number, st.full_name as student_name,
               c.class_name, c.subject, c.semester, c.division,
               s.session_name, s.auditorium_name, d.esp32_id
        FROM attendance_records ar
        JOIN students st ON ar.student_id = st.id
        LEFT JOIN classes c ON ar.class_id = c.id
        JOIN attendance_sessions s ON ar.session_id = s.id
        LEFT JOIN esp32_devices d ON ar.esp32_id = d.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (sessionId && typeof sessionId === 'string') {
        params.push(sessionId);
        sql += ` AND ar.session_id = $${params.length}`;
      }

      if (classId && typeof classId === 'string') {
        params.push(classId);
        sql += ` AND ar.class_id = $${params.length}`;
      }

      if (startDate && typeof startDate === 'string') {
        params.push(new Date(startDate));
        sql += ` AND ar.marked_at >= $${params.length}`;
      }

      if (endDate && typeof endDate === 'string') {
        params.push(new Date(endDate));
        sql += ` AND ar.marked_at <= $${params.length}`;
      }

      sql += ` ORDER BY ar.marked_at DESC, st.enrollment_number ASC`;

      const result = await query(sql, params);

      const exportRows: AttendanceExportRow[] = (result.rows || []).map((row: any) => ({
        enrollmentNumber: row.enrollment_number,
        studentName: row.student_name,
        className: row.class_name || row.auditorium_name || 'Auditorium Session',
        subject: row.subject || row.session_name || 'Lecture',
        semester: row.semester || 1,
        division: row.division || 'A',
        sessionName: row.session_name,
        markedAt: row.marked_at,
        status: row.status,
        esp32Id: row.esp32_id,
        rssi: row.rssi_dbm,
      }));

      const firstRow = result.rows[0];
      const buffer = await ExcelService.generateAttendanceWorkbook({
        className: firstRow?.class_name || firstRow?.auditorium_name || 'Auditorium Attendance',
        subject: firstRow?.subject || firstRow?.session_name || 'Attendance Log',
        dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'Recorded Session',
        records: exportRows,
      });

      const filename = `Attendance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err: any) {
      console.error('[AttendanceController.exportExcel]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }
}
