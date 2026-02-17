import { Router } from 'express';
import * as agentController from '../controllers/agent.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { roleMiddleware } from '../middleware/role.middleware.js';

const router = Router();

// Only agents can access /api/agent/*
router.use(authMiddleware, roleMiddleware(['agent']));

router.get('/status', agentController.status);
router.get('/leads', agentController.leads);

export default router;
