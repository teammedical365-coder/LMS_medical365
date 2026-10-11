/**
 * Lab Management System (LMS) - Server Health Service
 */

import api from './api';

export const healthService = {
  /**
   * Check backend API health status
   */
  async getHealth() {
    try {
      const response = await api.get('/health');
      return {
        isOnline: true,
        data: response.data.data,
      };
    } catch (error) {
      return {
        isOnline: false,
        error: error.message || 'Unable to contact backend server',
      };
    }
  },
};

export default healthService;
