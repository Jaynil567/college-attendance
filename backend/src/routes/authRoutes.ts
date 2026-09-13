import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Public login routes
router.post('/teacher/login', AuthController.teacherLogin);
router.post('/student/login', AuthController.studentLogin);

// Protected session check
router.get('/me', authenticateToken, AuthController.getMe);

export default router;
