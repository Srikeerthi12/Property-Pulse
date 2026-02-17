import { Router } from 'express';

import * as sellerController from '../controllers/seller.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { roleMiddleware } from '../middleware/role.middleware.js';

const router = Router();

router.use(authMiddleware, roleMiddleware(['seller']));

router.get('/property-leads', sellerController.propertyLeads);
router.get('/property-leads/:propertyId', sellerController.propertyLeadDetail);

export default router;
