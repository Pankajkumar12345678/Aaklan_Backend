import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

// Security Middleware
// app.use(helmet({
//   crossOriginResourcePolicy: { policy: "cross-origin" }
// }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://aaklan-frontend.vercel.app/',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(cookieParser());
app.use(compression());
app.use(morgan('combined')); // HTTP request logging

// Body parsing with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting - Different limits for different routes
// const generalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.'
// });

// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 5, // Only 5 login attempts per windowMs
//   message: 'Too many authentication attempts, please try again later.'
// });

// const aiLimiter = rateLimit({
//   windowMs: 1 * 60 * 1000, // 1 minute
//   max: 10, // Limit AI requests to prevent abuse
//   message: 'Too many AI requests, please slow down.'
// });

// Apply rate limiting
// app.use('/api/auth', authLimiter);
// app.use('/api/ai', aiLimiter);
// app.use('/api/', generalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/my-creations', creationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/curriculum', curriculumRoutes);

// Health Check with detailed info
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

// Welcome route
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

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});


connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 EduAmplify Backend Server Running`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📊 Admin Panel: http://localhost:${PORT}/api/admin`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/api/health`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
});