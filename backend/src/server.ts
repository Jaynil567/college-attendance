import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ENV } from './config/env.js';
import { testDbConnection } from './config/db.js';
import apiRouter from './routes/index.js';
import { seedDatabase } from './db/initDb.js';

const app = express();

// 1. Security & Middleware
app.use(cors({
  origin: '*', // Allow dashboard and mobile app clients
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 2. Global Rate Limiting (Allows high bursts for 200 concurrent student check-ins)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600, // 600 requests per minute per IP to easily support high concurrency in classroom Wi-Fi/NAT
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this network. Please wait a few moments.',
  },
});
app.use('/api', apiLimiter);

// 3. Mount API Router
app.use('/api', apiRouter);

// 4. Fallback 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'ENDPOINT_NOT_FOUND',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// 5. Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Server Exception]', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected internal error occurred.',
  });
});

// 6. Startup and Initialization
async function startServer() {
  console.log('----------------------------------------------------');
  console.log('🚀 Initializing College Classroom Attendance System');
  console.log('----------------------------------------------------');

  // Test Neon PostgreSQL connection
  const isConnected = await testDbConnection();
  if (!isConnected) {
    console.log('ℹ️  Tip: Set a valid DATABASE_URL in backend/.env to connect to your live Neon instance.');
  }

  // Seed default demonstration records (classes, admin, teacher, students, ESP32 device)
  await seedDatabase();

  const server = app.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`✅ Backend API server running on port: ${ENV.PORT} (0.0.0.0)`);
    console.log(`🔗 Health check available at: http://localhost:${ENV.PORT}/api/health`);
    console.log('----------------------------------------------------');
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('\n🛑 Gracefully shutting down server...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});

export default app;
