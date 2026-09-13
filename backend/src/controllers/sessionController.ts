import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/db.js';
import { ENV } from '../config/env.js';

const startSessionSchema = z.object({
  classId: z.string().uuid('Valid Class ID is required'),
  esp32Id: z.string().uuid('Valid ESP32 Device UUID is required'),
  sessionName: z.string().min(2, 'Session name / lecture topic is required'),
  durationMinutes: z.number().min(1).max(240).default(ENV.DEFAULT_SESSION_DURATION_MINUTES),
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

      const { classId, esp32Id, sessionName, durationMinutes } = parsed.data;

      // Close any currently active sessions for this class or device to prevent collisions
      await query(
        `UPDATE attendance_sessions
         SET status = 'closed'
         WHERE (class_id = $1 OR esp32_id = $2) AND status = 'active'`,
        [classId, esp32Id]
      );

      const sessionId = crypto.randomUUID();
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
      const createdBy = req.user?.id || null;

      const result = await query(
        `INSERT INTO attendance_sessions (
          id, class_id, esp32_id, session_name, start_time, end_time, status, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, NOW())
        RETURNING *`,
        [sessionId, classId, esp32Id, sessionName.trim(), startTime, endTime, createdBy]
      );

      // Fetch joined details
      const sessionWithDetails = await query(
        `SELECT s.*, c.class_name, c.subject, c.semester, c.division,
                d.esp32_id as device_esp32_id, d.device_name, d.classroom_id,
                d.service_uuid, d.char_challenge_uuid, d.char_response_uuid
         FROM attendance_sessions s
         JOIN classes c ON s.class_id = c.id
         JOIN esp32_devices d ON s.esp32_id = d.id
         WHERE s.id = $1`,
        [sessionId]
      );

      res.status(201).json({
        success: true,
        message: 'Attendance session started successfully',
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
        JOIN classes c ON s.class_id = c.id
        JOIN esp32_devices d ON s.esp32_id = d.id
        LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.status = 'present'
        WHERE s.status = 'active' AND s.end_time > NOW()
      `;
      const params: any[] = [];

      // If student, only show active session for their enrolled class
      if (req.user?.role === 'student' && req.user.classId) {
        params.push(req.user.classId);
        sql += ` AND s.class_id = $${params.length}`;
      }

      sql += ` GROUP BY s.id, c.id, d.id ORDER BY s.start_time DESC`;

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
        `SELECT s.*, c.class_name, c.subject, c.semester, c.division,
                d.esp32_id as device_esp32_id, d.device_name, d.classroom_id,
                d.service_uuid, d.char_challenge_uuid, d.char_response_uuid
         FROM attendance_sessions s
         JOIN classes c ON s.class_id = c.id
         JOIN esp32_devices d ON s.esp32_id = d.id
         WHERE s.id = $1`,
        [id]
      );

      if (!sessionRes.rows || sessionRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Session not found' });
        return;
      }

      const recordsRes = await query(
        `SELECT ar.*, st.enrollment_number, st.full_name
         FROM attendance_records ar
         JOIN students st ON ar.student_id = st.id
         WHERE ar.session_id = $1
         ORDER BY ar.marked_at DESC`,
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
}
