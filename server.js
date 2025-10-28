import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import connectDB from './config/database.js';

// Routes
import authRoutes from './routes/auth.js';
import templateRoutes from './routes/templates.js';
import aiRoutes from './routes/ai.js';
import lessonRoutes from './routes/lessons.js';
import creationRoutes from './routes/creations.js';
import exportRoutes from './routes/export.js';
import adminRoutes from './routes/admin.js';
import curriculumRoutes from './routes/curriculum.js';

dotenv.config();

const app = express();

// ----------------- CORS CONFIGURATION - CORRECTED -----------------
const allowedOrigins = [
  'https://aaklan-frontend.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
];

// SIMPLE & WORKING CORS CONFIGURATION
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

// ----------------- MIDDLEWARE -----------------
app.use(cookieParser());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ----------------- ROUTES -----------------
app.use('/api/auth', authRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/my-creations', creationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/curriculum', curriculumRoutes);

// ----------------- HEALTH CHECK -----------------
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      ai: process.env.GEMINI_API_KEY ? 'configured' : 'not configured'
    }
  });
});

// Test route for CORS
app.post('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS test successful',
    timestamp: new Date().toISOString()
  });
});

// ----------------- WELCOME -----------------
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to EduAmplify Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      templates: '/api/templates',
      ai: '/api/ai',
      lessons: '/api/lessons',
      creations: '/api/my-creations',
      export: '/api/export',
      admin: '/api/admin',
      curriculum: '/api/curriculum'
    },
    documentation: 'https://docs.eduamplify.com'
  });
});

// ----------------- 404 HANDLER -----------------
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// ----------------- ERROR HANDLER -----------------
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

// ----------------- DATABASE CONNECTION -----------------
connectDB();

// ----------------- SERVER -----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 EduAmplify Backend Server Running`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔄 CORS Test: http://localhost:${PORT}/api/test-cors`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
});