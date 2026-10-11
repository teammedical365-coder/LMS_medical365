/**
 * Lab Management System (LMS) - Health Controller
 */

import HealthService from '../services/health.service.js';
import ApiResponse from '../utils/apiResponse.js';

export class HealthController {
  /**
   * Handle GET /api/health or GET /api/v1/health
   */
  static getHealth(req, res) {
    const healthData = HealthService.getHealthStatus();
    return ApiResponse.success(res, healthData, 'Lab Management System API is operating normally');
  }
}

export default HealthController;
