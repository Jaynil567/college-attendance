import { Router } from 'express';
import { StudentController } from '../controllers/studentController.js';
import { authenticateToken, requireTeacherOrAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

// Teacher / Admin student management
router.get('/', requireTeacherOrAdmin, StudentController.getStudents);
router.post('/reset-all-passwords', requireTeacherOrAdmin, StudentController.resetAllPasswords);
router.get('/export-credentials', requireTeacherOrAdmin, StudentController.exportCredentials);
router.get('/:id', requireTeacherOrAdmin, StudentController.getStudentById);
router.post('/', requireTeacherOrAdmin, StudentController.createStudent); // Students cannot self-register!
router.put('/:id', requireTeacherOrAdmin, StudentController.updateStudent);
router.delete('/:id', requireTeacherOrAdmin, StudentController.deleteStudent);

export default router;
