/**
 * Lab Management System (LMS) - Standard API Response Formatter
 */

import { HTTP_STATUS } from '../config/constants.js';

export class ApiResponse {
  static success(res, data = {}, message = 'Operation successful', statusCode = HTTP_STATUS.OK, meta = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    });
  }

  static created(res, data = {}, message = 'Resource created successfully', meta = {}) {
    return this.success(res, data, message, HTTP_STATUS.CREATED, meta);
  }

  static error(res, message = 'Internal Server Error', statusCode = HTTP_STATUS.INTERNAL_ERROR, errors = null) {
    const payload = {
      success: false,
      message,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    if (errors) {
      payload.errors = errors;
    }

    return res.status(statusCode).json(payload);
  }
}

export default ApiResponse;
