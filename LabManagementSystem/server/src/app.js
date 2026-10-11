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
import { HTTP_STATUS } from './config/constants.js';
import { tenantBoundaryMiddleware } from './middleware/tenant.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import apiV1Router from './routes/index.js';
import HealthController from './controllers/health.controller.js';

const app = express();

// Security HTTP headers
app.use(helmet());

/**
 * Normalizes an origin string for strict matching (trimmed, lowercased, trailing slashes removed).
 */
export const normalizeOrigin = (origin) => {
  if (!origin || typeof origin !== 'string') return '';
  return origin.trim().replace(/\/+$/, '').toLowerCase();
};

/**
 * Validates whether an incoming HTTP Origin is trusted.
 * - Non-browser requests without Origin (curl, server-to-server, health probes) return true.
 * - In production: origin must match explicitly configured config.corsOrigins.
 * - In development/test: origin must match config.corsOrigins OR loopback localhost/127.0.0.1.
 * - All other origins return false.
 */
export const isOriginAllowed = (origin, customOrigins = config.corsOrigins, isProd = config.isProduction) => {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);

  // Check explicit allowlist
  if (customOrigins.some((trusted) => normalizeOrigin(trusted) === normalized)) {
    return true;
  }

  // In non-production environments, allow local development loopback origins
  if (!isProd) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
      return true;
    }
  }

  return false;
};

// CORS configuration (Hardened under SEC-02)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server, health checks)
      if (!origin) {
        return callback(null, true);
      }

      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }

      // Reject unrecognized or malicious origins cleanly without setting credentials or allow-origin headers
      const corsError = new Error('Cross-Origin Request Blocked: Origin not allowed by CORS policy');
      corsError.statusCode = HTTP_STATUS.FORBIDDEN;
      corsError.code = 'CORS_FORBIDDEN';
      return callback(corsError, false);
    },
    credentials: true,
    optionsSuccessStatus: HTTP_STATUS.NO_CONTENT,
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
