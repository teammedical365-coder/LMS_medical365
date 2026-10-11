/**
 * Lab Management System (LMS) - Authentication Routes
 * 
 * Mounted under /api/v1/auth
 */

import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import authRateLimiter from '../middleware/rateLimit.middleware.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const authRouter = Router();

// Super Admin platform login
authRouter.post('/super-admin/login', authRateLimiter, authController.superAdminLogin);

// Laboratory tenant user login
authRouter.post('/laboratory/login', authRateLimiter, authController.labUserLogin);

// Current user profile
authRouter.get('/me', authenticateToken, authController.getCurrentUser);

// Sign out / invalidate session
authRouter.post('/logout', authController.logout);

export default authRouter;
