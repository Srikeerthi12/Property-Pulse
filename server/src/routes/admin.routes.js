import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { roleMiddleware } from '../middleware/role.middleware.js';

const router = Router();

// Only admins can access /api/admin/*
router.use(authMiddleware, roleMiddleware(['admin']));

router.get('/status', adminController.status);
router.get('/stats', adminController.stats);
router.get('/users', adminController.users);
router.patch('/users/:id/active', adminController.setActive);
router.delete('/users/:id', adminController.remove);

router.get('/properties/pending', adminController.pendingProperties);
router.get('/properties', adminController.properties);
router.patch('/properties/:id/approve', adminController.approveProperty);
router.patch('/properties/:id/reject', adminController.rejectProperty);
router.get('/properties/:id/logs', adminController.propertyLogs);
router.delete('/properties/:id', adminController.removeProperty);

// CRM leads
router.get('/leads', adminController.leads);
router.patch('/leads/:id/assign', adminController.assignLead);

export default router;
