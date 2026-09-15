import { Router } from 'express';
import { StudentController } from '../controllers/studentController.js';

const router = Router();

// Route for daily automated password rotation via Vercel Cron
router.all('/rotate-passwords', StudentController.resetAllPasswords);

export default router;
