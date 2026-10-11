/**
 * Lab Management System (LMS) - Health Routes
 */

import { Router } from 'express';
import HealthController from '../controllers/health.controller.js';

const router = Router();

// GET /api/health or /api/v1/health
router.get('/', HealthController.getHealth);

export default router;
