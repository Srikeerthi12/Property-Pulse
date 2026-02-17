import { Router } from 'express';
import * as visitController from '../controllers/visit.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

// Admin + seller list (admin gets all, seller gets their properties)
router.get('/', visitController.list);

// Buyer
router.get('/my', visitController.listMy);

// Agent (admin may optionally provide agentId in query)
router.get('/agent', visitController.listAgent);

// Create visit request/schedule (buyer/agent/admin)
router.post('/', visitController.create);

// Updates
router.patch('/:id/status', visitController.updateStatus);
router.patch('/:id/reschedule', visitController.reschedule);
router.patch('/:id/reassign', visitController.reassign);

// Cancel
router.delete('/:id', visitController.remove);

export default router;
