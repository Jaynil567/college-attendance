import { Router } from 'express';
import authRoutes from './authRoutes.js';
import classRoutes from './classRoutes.js';
import studentRoutes from './studentRoutes.js';
import deviceRoutes from './deviceRoutes.js';
import sessionRoutes from './sessionRoutes.js';
import attendanceRoutes from './attendanceRoutes.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    service: 'College Classroom Attendance System API',
    timestamp: new Date().toISOString(),
    cryptoEngine: 'HMAC-SHA256 (mbedTLS & Node.js Crypto)',
  });
});

// Mounted sub-routes
router.use('/auth', authRoutes);
router.use('/classes', classRoutes);
router.use('/students', studentRoutes);
router.use('/devices', deviceRoutes);
router.use('/sessions', sessionRoutes);
router.use('/attendance', attendanceRoutes);

export default router;
