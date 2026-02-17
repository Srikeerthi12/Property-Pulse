import { Router } from 'express';

import * as favoriteController from '../controllers/favorite.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { roleMiddleware } from '../middleware/role.middleware.js';

const router = Router();

router.use(authMiddleware, roleMiddleware(['buyer']));

router.post('/', favoriteController.add);
router.get('/', favoriteController.list);
router.delete('/:id', favoriteController.remove);

export default router;
