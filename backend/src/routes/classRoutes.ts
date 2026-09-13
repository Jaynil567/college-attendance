import { Router } from 'express';
import { ClassController } from '../controllers/classController.js';
import { authenticateToken, requireTeacherOrAdmin } from '../middleware/auth.js';

const router = Router();

// Teachers and Admins can manage classes
router.use(authenticateToken);
router.get('/', ClassController.getClasses);
router.get('/:id', ClassController.getClassById);
router.post('/', requireTeacherOrAdmin, ClassController.createClass);
router.put('/:id', requireTeacherOrAdmin, ClassController.updateClass);
router.delete('/:id', requireTeacherOrAdmin, ClassController.deleteClass);

export default router;
