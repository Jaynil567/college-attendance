import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/db.js';
import { ENV } from '../config/env.js';

const AUDITORIUM_CONFIG = [
  { id: 'AUDITORIUM_01', name: 'Engineering Auditorium' },
  { id: 'AUDITORIUM_02', name: 'Architecture Auditorium' },
  { id: 'AUDITORIUM_03', name: 'LAW Auditorium' },
];

const startSessionSchema = z.object({
  auditoriumId: z.enum(['AUDITORIUM_01', 'AUDITORIUM_02', 'AUDITORIUM_03']).optional(),
  subject: z.string().min(2, 'Subject / Lecture title is required').optional(),
  targetDivisions: z.array(z.string()).optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  esp32Id: z.string().optional().nullable(),
  sessionName: z.string().optional().nullable(),
  durationMinutes: z.number().min(1).max(480).optional().nullable(),
  requireSimVerification: z.boolean().optional().default(true),
});

export class SessionController {
  /**
   * Start an attendance session for a class with an assigned ESP32 device
   */
  static async startSession(req: Request, res: Response): Promise<void> {
    try {
      const parsed = startSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.format(),
        });
        return;
      }

      const { auditoriumId, subject, targetDivisions, classId, esp32Id, sessionName, durationMinutes, requireSimVerification } = parsed.data;
      const createdBy = req.user?.id || null;
      const sessionId = crypto.randomUUID();
      const startTime = new Date();
      const endTime = durationMinutes ? new Date(startTime.getTime() + durationMinutes * 60 * 1000) : null;

      let targetAuditoriumId = auditoriumId || null;
      let targetAuditoriumName = null;
      let targetEsp32DeviceId = esp32Id || null;
      const lectureTitle = (subject || sessionName || 'Lecture').trim();
      const targetDivisionsStr = targetDivisions && targetDivisions.length > 0 ? JSON.stringify(targetDivisions) : null;

      if (targetAuditoriumId) {
        const audiMatch = AUDITORIUM_CONFIG.find((a) => a.id === targetAuditoriumId);
        targetAuditoriumName = audiMatch ? audiMatch.name : targetAuditoriumId;

        // Find device linked to this auditorium
        const devRes = await query(
          `SELECT id, esp32_id FROM esp32_devices WHERE UPPER(esp32_id) = $1 LIMIT 1`,
          [targetAuditoriumId.toUpperCase()]
        );
        if (devRes.rows && devRes.rows.length > 0) {
          targetEsp32DeviceId = devRes.rows[0].id;
        }

        // Close any currently active sessions for this auditorium
        await query(
          `UPDATE attendance_sessions
           SET status = 'closed', end_time = NOW()
           WHERE (auditorium_id = $1 OR esp32_id = $2) AND status = 'active'`,
          [targetAuditoriumId, targetEsp32DeviceId]
        );
      } else if (classId && targetEsp32DeviceId) {
        // Close previous class or device sessions
        await query(
          `UPDATE attendance_sessions
           SET status = 'closed', end_time = NOW()
           WHERE (class_id = $1 OR esp32_id = $2) AND status = 'active'`,
          [classId, targetEsp32DeviceId]
        );
      } else {
        res.status(400).json({
          success: false,
          error: 'MISSING_TARGET',
          message: 'Either auditoriumId or (classId and esp32Id) must be provided.',
        });
        return;
      }

      const result = await query(
        `INSERT INTO attendance_sessions (
          id, class_id, esp32_id, auditorium_id, auditorium_name, session_name, target_divisions,
          start_time, end_time, status, created_by, require_sim_verification, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, NOW())
        RETURNING *`,
        [sessionId, classId || null, targetEsp32DeviceId, targetAuditoriumId, targetAuditoriumName, lectureTitle, targetDivisionsStr, startTime, endTime, createdBy, requireSimVerification]
      );

      // Fetch joined details
      const sessionWithDetails = await query(
        `SELECT s.*, 
                c.class_name, c.subject as class_subject, c.semester, c.division,
                t.full_name as teacher_name, t.email as teacher_email,
                d.esp32_id as device_esp32_id, d.device_name, d.classroom_id,
                d.service_uuid, d.char_challenge_uuid, d.char_response_uuid
         FROM attendance_sessions s
         LEFT JOIN classes c ON s.class_id = c.id
         LEFT JOIN users t ON s.created_by = t.id
         LEFT JOIN esp32_devices d ON s.esp32_id = d.id
         WHERE s.id = $1`,
        [sessionId]
      );

      res.status(201).json({
        success: true,
        message: `Attendance session started for ${targetAuditoriumName || 'Class'} successfully`,
        session: sessionWithDetails.rows[0] || result.rows[0],
      });
    } catch (err: any) {
      console.error('[SessionController.startSession]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Close an active attendance session
   */
  static async closeSession(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await query(
        `UPDATE attendance_sessions
         SET status = 'closed', end_time = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (!result.rows || result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Session not found' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Attendance session closed successfully',
        session: result.rows[0],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Get 3 Auditoriums real-time status:
   * Returns each Auditorium's device info, active session (if any), and whether calling student has marked attendance.
   */
  static async getAuditoriumsStatus(req: Request, res: Response): Promise<void> {
    try {
      const studentId = req.user?.role === 'student' ? req.user.id : null;

      // 1. Fetch the 3 Auditorium devices
      const devRes = await query(
        `SELECT id, esp32_id, device_name, classroom_id, service_uuid, char_challenge_uuid, char_response_uuid, device_status
         FROM esp32_devices
         WHERE UPPER(esp32_id) IN ('AUDITORIUM_01', 'AUDITORIUM_02', 'AUDITORIUM_03')`
      );
      const devices = devRes.rows || [];

      // 2. Fetch active sessions in auditoriums
      const activeSessionsRes = await query(
        `SELECT s.id, s.session_name, s.auditorium_id, s.auditorium_name, s.target_divisions, s.start_time, s.end_time, s.created_by, s.require_sim_verification,
                t.full_name as teacher_name,
                COUNT(ar.id)::int as present_count
         FROM attendance_sessions s
         LEFT JOIN users t ON s.created_by = t.id
         LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.status = 'present'
         WHERE s.status = 'active'
         GROUP BY s.id, t.full_name`
      );
      const activeSessions = activeSessionsRes.rows || [];

      // 3. If student, get student's division & check if they marked attendance
      let studentDivision: string | null = null;
      let markedSessionIds = new Set<string>();
      if (studentId) {
        const studentRes = await query(`SELECT division FROM students WHERE id = $1`, [studentId]);
        if (studentRes.rows && studentRes.rows.length > 0) {
          studentDivision = studentRes.rows[0].division;
        }

        const markedRes = await query(
          `SELECT session_id FROM attendance_records WHERE student_id = $1 AND status = 'present'`,
          [studentId]
        );
        markedSessionIds = new Set((markedRes.rows || []).map((r: any) => r.session_id));
      }

      const auditoriums = AUDITORIUM_CONFIG.map((audi) => {
        const device = devices.find((d: any) => d.esp32_id?.toUpperCase() === audi.id);
        let activeSession = activeSessions.find(
          (s: any) => s.auditorium_id === audi.id || (device && s.esp32_id === device.id)
        );

        // Check division restriction for student
        if (activeSession && studentId && studentDivision) {
          let targetDivs: string[] = [];
          if (activeSession.target_divisions) {
            try {
              targetDivs = typeof activeSession.target_divisions === 'string'
                ? JSON.parse(activeSession.target_divisions)
                : activeSession.target_divisions;
            } catch (e) {
              targetDivs = String(activeSession.target_divisions).split(',').map((s) => s.trim());
            }
          }
          if (targetDivs.length > 0 && !targetDivs.includes(studentDivision)) {
            activeSession = null;
          }
        }

        return {
          id: audi.id,
          name: audi.name,
          device: device || null,
          isLive: !!activeSession,
          activeSession: activeSession
            ? {
                id: activeSession.id,
                subject: activeSession.session_name,
                sessionName: activeSession.session_name,
                teacherName: activeSession.teacher_name || 'Faculty',
                createdBy: activeSession.created_by,
                created_by: activeSession.created_by,
                startTime: activeSession.start_time,
                targetDivisions: activeSession.target_divisions,
                presentCount: activeSession.present_count || 0,
                requireSimVerification: activeSession.require_sim_verification !== false,
              }
            : null,
          hasMarkedAttendance: activeSession ? markedSessionIds.has(activeSession.id) : false,
        };
      });

      res.status(200).json({
        success: true,
        auditoriums,
      });
    } catch (err: any) {
      console.error('[SessionController.getAuditoriumsStatus]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Get currently active attendance sessions (for Teacher or Student)
   */
  static async getActiveSessions(req: Request, res: Response): Promise<void> {
    try {
      let sql = `
        SELECT s.*, c.class_name, c.subject, c.semester, c.division,
               d.esp32_id as device_esp32_id, d.device_name, d.classroom_id,
               d.service_uuid, d.char_challenge_uuid, d.char_response_uuid,
               COUNT(ar.id)::int as present_count
        FROM attendance_sessions s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN users t ON s.created_by = t.id
        LEFT JOIN esp32_devices d ON (s.esp32_id = d.id OR s.auditorium_id = d.esp32_id)
        LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.status = 'present'
        WHERE s.status = 'active'
      `;
      const params: any[] = [];

      // If student, only show active session for their enrolled class
      if (req.user?.role === 'student' && req.user.classId) {
        params.push(req.user.classId);
        sql += ` AND (s.class_id IS NULL OR s.class_id = $${params.length})`;
      }

      sql += ` GROUP BY s.id, c.id, t.full_name, d.id ORDER BY s.start_time DESC`;

      const result = await query(sql, params);

      res.status(200).json({
        success: true,
        sessions: result.rows || [],
      });
    } catch (err: any) {
      console.error('[SessionController.getActiveSessions]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Get single session with live attendance feed
   */
  static async getSessionById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const sessionRes = await query(
        `SELECT s.*, 
                c.class_name, c.subject as class_subject, c.semester, c.division,
                t.full_name as teacher_name, t.email as teacher_email,
                d.esp32_id as device_esp32_id, d.device_name, d.classroom_id,
                d.service_uuid, d.char_challenge_uuid, d.char_response_uuid
         FROM attendance_sessions s
         LEFT JOIN classes c ON s.class_id = c.id
         LEFT JOIN users t ON s.created_by = t.id
         LEFT JOIN esp32_devices d ON (s.esp32_id = d.id OR s.auditorium_id = d.esp32_id)
         WHERE s.id = $1`,
        [id]
      );

      if (!sessionRes.rows || sessionRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Session not found' });
        return;
      }

      const recordsRes = await query(
        `SELECT ar.*, st.enrollment_number, st.full_name, COALESCE(st.division, 'N/A') as division, COALESCE(st.roll_number, 'N/A') as roll_number, COALESCE(st.group_name, 'N/A') as group_name
         FROM attendance_records ar
         JOIN students st ON ar.student_id = st.id
         WHERE ar.session_id = $1
         ORDER BY COALESCE(st.group_name, '') ASC, COALESCE(st.division, '') ASC, NULLIF(regexp_replace(COALESCE(st.roll_number, '0'), '\\D', '', 'g'), '')::INTEGER ASC NULLS LAST, st.roll_number ASC, ar.marked_at DESC`,
        [id]
      );

      res.status(200).json({
        success: true,
        session: sessionRes.rows[0],
        records: recordsRes.rows || [],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Get all attendance sessions (active and closed)
   */
  static async getAllSessions(req: Request, res: Response): Promise<void> {
    try {
      const { status, limit = 100 } = req.query;
      let sql = `
        SELECT s.*, 
               t.full_name as teacher_name,
               COUNT(DISTINCT ar.student_id)::int as present_count,
               (SELECT COUNT(*)::int FROM students WHERE status = 'active') as total_students
        FROM attendance_sessions s
        LEFT JOIN users t ON s.created_by = t.id
        LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.status = 'present'
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status && typeof status === 'string') {
        params.push(status);
        sql += ` AND s.status = $${params.length}`;
      }

      sql += ` GROUP BY s.id, t.full_name ORDER BY s.start_time DESC LIMIT $${params.length + 1}`;
      params.push(Number(limit));

      const result = await query(sql, params);

      res.status(200).json({
        success: true,
        count: result.rows.length,
        sessions: result.rows || [],
      });
    } catch (err: any) {
      console.error('[SessionController.getAllSessions]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }
}
