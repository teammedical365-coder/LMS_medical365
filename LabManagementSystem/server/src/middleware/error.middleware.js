/**
 * Lab Management System (LMS) - Centralized Error Handler Middleware
 */

import { HTTP_STATUS } from '../config/constants.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_ERROR;
  const message = err.message || 'An unexpected internal server error occurred';

  logger.error(`[${req.method}] ${req.url} - Error: ${message}`, {
    stack: config.isDevelopment ? err.stack : undefined,
  });

  const responsePayload = {
    success: false,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
    },
  };

  if (err.code) {
    responsePayload.errors = err.code;
  }

  // Provide details only in non-production environments; NEVER leak credentials/secrets
  if (config.isDevelopment && err.stack) {
    responsePayload.debug = {
      name: err.name,
      stack: err.stack,
    };
  }

  return res.status(statusCode).json(responsePayload);
}

export default errorHandler;
