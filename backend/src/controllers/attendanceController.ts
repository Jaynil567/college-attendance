import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/db.js';
import { ExcelService, AttendanceExportRow } from '../services/excelService.js';

function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

const markAttendanceSchema = z.object({
  sessionId: z.string().uuid('Valid Session ID is required'),
  deviceFingerprint: z.string().min(5, 'Device fingerprint is required'),
  biometricVerified: z.boolean(),
  bleRssi: z.number().int().optional().default(-65),
  bleDeviceName: z.string().optional().default('Teacher Phone'),
  hasSimCard: z.boolean().optional(),
  simCarrier: z.string().optional(),
  simCountry: z.string().optional(),
  simPhoneNumber: z.string().optional(),
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

      const { sessionId, deviceFingerprint, biometricVerified, bleRssi, bleDeviceName, hasSimCard, simCarrier, simPhoneNumber } = parsed.data;

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

      if (session.status !== 'active') {
        res.status(400).json({ success: false, error: 'SESSION_CLOSED', message: 'Attendance session is no longer active.' });
        return;
      }

      // SIM verification (optional per session settings set by teacher)
      const requireSim = session.require_sim_verification !== false;
      if (requireSim) {
        if (hasSimCard === false) {
          res.status(403).json({
            success: false,
            error: 'SIM_CARD_REQUIRED',
            message: '❌ Active SIM card matching your registered mobile number is required in your phone.',
          });
          return;
        }

        if (student.phone_number && simPhoneNumber) {
          const studentNormPhone = normalizePhoneNumber(student.phone_number);
          const simNormPhone = normalizePhoneNumber(simPhoneNumber);
          if (studentNormPhone && simNormPhone && studentNormPhone !== simNormPhone) {
            res.status(403).json({
              success: false,
              error: 'SIM_NUMBER_MISMATCH',
              message: `❌ SIM card mismatch! Active device SIM does not match your registered number (${student.phone_number}).`,
            });
            return;
          }
        }
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
   * Shows all completed lectures for student's division with Present / Absent status
   */
  static async getStudentHistory(req: Request, res: Response): Promise<void> {
    try {
      const studentId = req.user?.id;
      if (!studentId) {
        res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
        return;
      }

      // 1. Fetch student division & details
      const studentRes = await query('SELECT division, enrollment_number, full_name FROM students WHERE id = $1', [studentId]);
      if (!studentRes.rows || studentRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'STUDENT_NOT_FOUND' });
        return;
      }
      const studentDivision = (studentRes.rows[0].division || '').trim().toUpperCase();

      // 2. Fetch all completed/recorded sessions
      const sessionsRes = await query(
        `SELECT s.id, s.session_name, s.auditorium_id, s.auditorium_name, s.target_divisions, 
                s.start_time, s.end_time, s.created_by,
                c.class_name, c.subject, c.semester
         FROM attendance_sessions s
         LEFT JOIN classes c ON s.class_id = c.id
         ORDER BY s.start_time DESC`
      );

      // 3. Fetch all attendance records marked by this student
      const recordsRes = await query(
        `SELECT id, session_id, marked_at, status, rejection_reason
         FROM attendance_records
         WHERE student_id = $1`,
        [studentId]
      );

      const recordMap = new Map<string, any>();
      for (const rec of recordsRes.rows) {
        recordMap.set(rec.session_id, rec);
      }

      const allRecords: any[] = [];
      let presentCount = 0;

      for (const sess of sessionsRes.rows) {
        // Parse target_divisions
        let targetDivs: string[] = [];
        if (sess.target_divisions) {
          try {
            targetDivs = typeof sess.target_divisions === 'string'
              ? JSON.parse(sess.target_divisions)
              : sess.target_divisions;
          } catch (e) {
            targetDivs = String(sess.target_divisions).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
          }
        }

        // Check if session applies to student's division (if empty/all, applies to all)
        const isTarget = targetDivs.length === 0 || targetDivs.some((d) => d.toUpperCase() === studentDivision);

        if (isTarget) {
          const rec = recordMap.get(sess.id);
          const isPresent = rec && rec.status === 'present';
          if (isPresent) presentCount++;

          allRecords.push({
            id: rec ? rec.id : `absent_${sess.id}`,
            sessionId: sess.id,
            session_name: sess.session_name || 'Lecture Session',
            subject: sess.subject || 'Classroom Lecture',
            className: sess.class_name || 'General',
            auditorium_name: sess.auditorium_name || 'Auditorium',
            marked_at: rec ? rec.marked_at : (sess.end_time || sess.start_time),
            start_time: sess.start_time,
            end_time: sess.end_time,
            status: isPresent ? 'present' : 'absent',
            division: studentDivision,
          });
        }
      }

      const totalCount = allRecords.length;
      const absentCount = totalCount - presentCount;
      const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

      res.status(200).json({
        success: true,
        stats: {
          totalSessions: totalCount,
          presentCount,
          absentCount,
          percentage,
        },
        records: allRecords,
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
               COALESCE(st.division, 'N/A') as student_division,
               COALESCE(st.roll_number, 'N/A') as roll_number,
               COALESCE(st.group_name, 'N/A') as group_name,
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

      sql += ` ORDER BY COALESCE(st.group_name, '') ASC, COALESCE(st.division, '') ASC, NULLIF(regexp_replace(COALESCE(st.roll_number, '0'), '\\D', '', 'g'), '')::INTEGER ASC NULLS LAST, st.roll_number ASC, ar.marked_at DESC`;

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
      const { classId, sessionId, startDate, endDate, division, groupName } = req.query;

      let result;
      let sessionName = 'Attendance_Session';
      let auditoriumName = 'Auditorium';
      let sessionStartTime = new Date();

      if (sessionId && typeof sessionId === 'string') {
        const sessRes = await query(
          `SELECT session_name, auditorium_name, target_divisions, start_time FROM attendance_sessions WHERE id = $1`,
          [sessionId]
        );
        let targetDivs: string[] = [];

        if (sessRes.rows && sessRes.rows.length > 0) {
          sessionName = sessRes.rows[0].session_name || 'Attendance_Session';
          auditoriumName = sessRes.rows[0].auditorium_name || 'Auditorium';
          sessionStartTime = sessRes.rows[0].start_time || new Date();

          if (sessRes.rows[0].target_divisions) {
            try {
              targetDivs = typeof sessRes.rows[0].target_divisions === 'string'
                ? JSON.parse(sessRes.rows[0].target_divisions)
                : sessRes.rows[0].target_divisions;
            } catch (e) {
              targetDivs = String(sessRes.rows[0].target_divisions).split(',').map((s) => s.trim()).filter(Boolean);
            }
          }
        }

        // Query ALL students for this session's selected divisions (showing PRESENT or ABSENT)
        let sql = `
          SELECT st.enrollment_number, st.full_name as student_name,
                 COALESCE(st.division, 'N/A') as division,
                 COALESCE(st.roll_number, 'N/A') as roll_number,
                 COALESCE(st.group_name, 'N/A') as group_name,
                 CASE WHEN ar.id IS NOT NULL THEN COALESCE(ar.status, 'PRESENT') ELSE 'ABSENT' END as status,
                 ar.marked_at
          FROM students st
          LEFT JOIN attendance_records ar ON ar.student_id = st.id AND ar.session_id = $1
          WHERE st.status = 'active'
        `;
        const params: any[] = [sessionId];

        if (targetDivs.length > 0) {
          params.push(targetDivs);
          sql += ` AND st.division = ANY($${params.length})`;
        }

        if (division && typeof division === 'string' && division.trim() !== '') {
          params.push(division.trim());
          sql += ` AND st.division = $${params.length}`;
        }
        if (groupName && typeof groupName === 'string' && groupName.trim() !== '') {
          params.push(groupName.trim());
          sql += ` AND st.group_name = $${params.length}`;
        }

        sql += ` ORDER BY COALESCE(st.group_name, '') ASC, COALESCE(st.division, '') ASC, NULLIF(regexp_replace(COALESCE(st.roll_number, '0'), '\\D', '', 'g'), '')::INTEGER ASC NULLS LAST, st.roll_number ASC`;
        result = await query(sql, params);
      } else {
        let sql = `
          SELECT ar.id, ar.marked_at, ar.status,
                 st.enrollment_number, st.full_name as student_name,
                 COALESCE(st.division, 'N/A') as division,
                 COALESCE(st.roll_number, 'N/A') as roll_number,
                 COALESCE(st.group_name, 'N/A') as group_name,
                 s.session_name, s.auditorium_name
          FROM attendance_records ar
          JOIN students st ON ar.student_id = st.id
          JOIN attendance_sessions s ON ar.session_id = s.id
          WHERE 1=1
        `;
        const params: any[] = [];

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

        sql += ` ORDER BY COALESCE(st.group_name, '') ASC, COALESCE(st.division, '') ASC, NULLIF(regexp_replace(COALESCE(st.roll_number, '0'), '\\D', '', 'g'), '')::INTEGER ASC NULLS LAST, st.roll_number ASC, ar.marked_at DESC`;
        result = await query(sql, params);
      }

      const exportRows: AttendanceExportRow[] = (result.rows || []).map((row: any) => ({
        enrollmentNumber: row.enrollment_number,
        studentName: row.student_name,
        division: row.division || 'N/A',
        rollNumber: row.roll_number || 'N/A',
        groupName: row.group_name || 'N/A',
        status: row.status,
        markedAt: row.marked_at,
      }));

      const buffer = await ExcelService.generateAttendanceWorkbook({
        className: auditoriumName,
        subject: sessionName,
        dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'Lecture Attendance',
        records: exportRows,
      });

      // Excel Filename == Session Name + Date
      const dateStr = new Date(sessionStartTime).toISOString().slice(0, 10);
      const cleanSessionName = sessionName.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `${cleanSessionName}_${dateStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.send(buffer);
    } catch (err: any) {
      console.error('[AttendanceController.exportExcel]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Teacher Manual Attendance Check-In (by Division & Roll Number)
   */
  static async manualMarkAttendance(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || (req.user.role !== 'teacher' && req.user.role !== 'admin')) {
        res.status(403).json({
          success: false,
          error: 'TEACHER_ONLY',
          message: 'Only teachers or administrators can manually mark attendance.',
        });
        return;
      }

      const { sessionId, division, rollNumber } = req.body;

      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Valid Session ID is required' });
        return;
      }

      if (!division || typeof division !== 'string' || division.trim() === '') {
        res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Division is required (e.g. A1)' });
        return;
      }

      if (!rollNumber || typeof rollNumber !== 'string' || rollNumber.trim() === '') {
        res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Roll Number is required (e.g. 86)' });
        return;
      }

      const cleanDiv = division.trim().toUpperCase();
      const cleanRoll = rollNumber.trim();

      // 1. Fetch Student by Division and Roll Number
      const studentRes = await query(
        `SELECT id, enrollment_number, full_name, division, roll_number, group_name, status
         FROM students
         WHERE UPPER(division) = $1 AND (roll_number = $2 OR regexp_replace(roll_number, '\\D', '', 'g') = $2)`,
        [cleanDiv, cleanRoll]
      );

      if (!studentRes.rows || studentRes.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'STUDENT_NOT_FOUND',
          message: `No active student found in Division '${cleanDiv}' with Roll Number '${cleanRoll}'.`,
        });
        return;
      }

      const student = studentRes.rows[0];

      // 2. Fetch Session Details
      const sessionRes = await query(
        `SELECT s.id, s.session_name, s.status, s.esp32_id, s.class_id
         FROM attendance_sessions s
         WHERE s.id = $1`,
        [sessionId]
      );

      if (!sessionRes.rows || sessionRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'SESSION_NOT_FOUND', message: 'Session not found' });
        return;
      }

      const session = sessionRes.rows[0];
      if (session.status !== 'active') {
        res.status(400).json({ success: false, error: 'SESSION_CLOSED', message: 'Session is no longer active.' });
        return;
      }

      // 3. Upsert / Insert Attendance Record
      const existingRes = await query(
        'SELECT id, status FROM attendance_records WHERE session_id = $1 AND student_id = $2',
        [sessionId, student.id]
      );

      let recordId: string;
      if (existingRes.rows && existingRes.rows.length > 0) {
        const existing = existingRes.rows[0];
        if (existing.status === 'present') {
          res.status(409).json({
            success: false,
            error: 'ALREADY_MARKED',
            message: `${student.full_name} (${student.division}-${student.roll_number}) is already marked Present.`,
          });
          return;
        }

        const updateRes = await query(
          `UPDATE attendance_records
           SET status = 'present', marked_at = NOW(), rejection_reason = NULL, device_info = 'MANUAL_TEACHER'
           WHERE id = $1 RETURNING id`,
          [existing.id]
        );
        recordId = updateRes.rows[0].id;
      } else {
        const insertRes = await query(
          `INSERT INTO attendance_records (session_id, student_id, class_id, esp32_id, status, device_info, marked_at)
           VALUES ($1, $2, $3, $4, 'present', 'MANUAL_TEACHER', NOW())
           RETURNING id`,
          [sessionId, student.id, session.class_id || null, session.esp32_id]
        );
        recordId = insertRes.rows[0].id;
      }

      res.status(200).json({
        success: true,
        message: `✅ Marked Present for ${student.full_name} (Div: ${student.division}, Roll: ${student.roll_number})`,
        recordId,
        student: {
          id: student.id,
          full_name: student.full_name,
          enrollment_number: student.enrollment_number,
          division: student.division,
          roll_number: student.roll_number,
          group_name: student.group_name,
        },
      });
    } catch (err: any) {
      console.error('[AttendanceController.manualMarkAttendance]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }
}
