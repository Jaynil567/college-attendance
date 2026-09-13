import { Router } from 'express';
import { AttendanceController } from '../controllers/attendanceController.js';
import { authenticateToken, requireTeacherOrAdmin, requireStudent } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

// Student marks attendance with ESP32 cryptographic challenge-response
router.post('/mark', requireStudent, AttendanceController.markAttendance);

// Student views their attendance history
router.get('/history', requireStudent, AttendanceController.getStudentHistory);

// Teacher/Admin views filtered attendance reports
router.get('/report', requireTeacherOrAdmin, AttendanceController.getAttendanceReport);

// Teacher/Admin exports attendance to XLSX Excel file
router.get('/export', requireTeacherOrAdmin, AttendanceController.exportExcel);

export default router;
