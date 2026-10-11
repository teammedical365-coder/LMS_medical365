/**
 * Lab Management System (LMS) - 404 Not Found Middleware
 */

import { HTTP_STATUS } from '../config/constants.js';

export function notFoundHandler(req, res, next) {
  return res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: `Resource not found: [${req.method}] ${req.originalUrl}`,
    meta: {
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      suggestion: 'Check API route prefix (/api/v1) or refer to API documentation.',
    },
  });
}

export default notFoundHandler;
