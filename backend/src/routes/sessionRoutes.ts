import { Router } from 'express';
import { SessionController } from '../controllers/sessionController.js';
import { authenticateToken, requireTeacherOrAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

// Students and teachers can query active sessions and 3-Auditorium real-time status
router.get('/auditoriums-status', SessionController.getAuditoriumsStatus);
router.get('/active', SessionController.getActiveSessions);
router.get('/all', SessionController.getAllSessions);
router.get('/:id', SessionController.getSessionById);

// Teacher/Admin can control session lifecycle
router.post('/start', requireTeacherOrAdmin, SessionController.startSession);
router.post('/:id/close', requireTeacherOrAdmin, SessionController.closeSession);
router.post('/:id/end', requireTeacherOrAdmin, SessionController.closeSession);
router.patch('/:id/close', requireTeacherOrAdmin, SessionController.closeSession);
router.patch('/:id/end', requireTeacherOrAdmin, SessionController.closeSession);

export default router;
