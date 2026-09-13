import { Router } from 'express';
import { TeacherController } from '../controllers/teacherController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All teacher management routes require Admin authorization
router.use(requireAuth, requireAdmin);

router.get('/', TeacherController.getTeachers);
router.post('/', TeacherController.createTeacher);
router.put('/:id', TeacherController.updateTeacher);
router.delete('/:id', TeacherController.deleteTeacher);

export default router;
