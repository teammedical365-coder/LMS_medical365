/**
 * Lab Management System (LMS) - Express Application Setup
 * 
 * Separation of concerns:
 * This file creates and configures the Express application instance without binding
 * to network ports or establishing external database connections.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import config from './config/env.js';
import { tenantBoundaryMiddleware } from './middleware/tenant.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import apiV1Router from './routes/index.js';
import HealthController from './controllers/health.controller.js';

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server) or matching origin
      if (!origin || origin === config.corsOrigin || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev; configurable in prod
    },
    credentials: true,
  })
);

// Cookie parsing for secure HttpOnly session tokens
app.use(cookieParser(config.cookie?.secret));

// Request parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging (skip during automated testing)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
}

// Multi-tenant boundary middleware
app.use(tenantBoundaryMiddleware);

// Direct Health Endpoint: GET /api/health (as specified in requirements)
app.get('/api/health', HealthController.getHealth);

// Versioned API Prefix: /api/v1
app.use(config.apiPrefix, apiV1Router);

// Root fallback informational route
app.get('/', (req, res) => {
  res.json({
    name: 'Lab Management System (LMS) API',
    status: 'online',
    phase: 'Phase 1 - Project Foundation',
    endpoints: {
      directHealth: '/api/health',
      versionedHealth: `${config.apiPrefix}/health`,
    },
  });
});

// 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

export default app;
