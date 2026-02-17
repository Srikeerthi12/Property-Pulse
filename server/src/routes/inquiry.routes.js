import { Router } from 'express';

import * as inquiryController from '../controllers/inquiry.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { roleMiddleware } from '../middleware/role.middleware.js';

const router = Router();

// Buyer
router.post('/', authMiddleware, roleMiddleware(['buyer']), inquiryController.createBuyerInquiry);
router.get('/my', authMiddleware, roleMiddleware(['buyer']), inquiryController.myInquiries);
router.patch('/:id/offer', authMiddleware, roleMiddleware(['buyer']), inquiryController.submitOffer);

// Agent pipeline + notes
router.patch('/:id/status', authMiddleware, roleMiddleware(['agent']), inquiryController.updateStatus);
router.post('/:id/notes', authMiddleware, roleMiddleware(['agent']), inquiryController.addNote);

// Notes listing: agent (assigned) OR admin (controller enforces)
router.get('/:id/notes', authMiddleware, roleMiddleware(['agent', 'admin']), inquiryController.notes);

export default router;
