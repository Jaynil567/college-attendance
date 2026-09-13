import { Router } from 'express';
import { DeviceController } from '../controllers/deviceController.js';
import { authenticateToken, requireTeacherOrAdmin } from '../middleware/auth.js';

const router = Router();

// Heartbeat can be public or authenticated
router.post('/heartbeat', DeviceController.heartbeat);

// Protected device management
router.use(authenticateToken);
router.get('/', requireTeacherOrAdmin, DeviceController.getDevices);
router.post('/', requireTeacherOrAdmin, DeviceController.registerDevice);
router.put('/:id/rotate-key', requireTeacherOrAdmin, DeviceController.rotateKey);

export default router;
