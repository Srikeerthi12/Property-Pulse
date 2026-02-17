import { Router } from 'express';
import {
	create,
	deleteImage,
	getById,
	logs,
	listApproved,
	listMine,
	markInactive,
	remove,
	submitForApproval,
	trackView,
	update,
} from '../controllers/property.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuth.middleware.js';
import { propertyImagesUpload } from '../middleware/upload.middleware.js';

const router = Router();

// Public
router.get('/', listApproved);

// Seller/Agent
router.get('/mine', authMiddleware, listMine);
router.post('/', authMiddleware, propertyImagesUpload, create);
router.patch('/:id', authMiddleware, propertyImagesUpload, update);
router.post('/:id/submit', authMiddleware, submitForApproval);
router.patch('/:id/inactive', authMiddleware, markInactive);
router.delete('/:id/images/:imageId', authMiddleware, deleteImage);
router.delete('/:id', authMiddleware, remove);

router.get('/:id/logs', authMiddleware, logs);

// View tracking (separate from GET to avoid double-counting in dev StrictMode)
router.post('/:id/view', optionalAuthMiddleware, trackView);

// Public detail (kept after /mine so it doesn't shadow it)
router.get('/:id', optionalAuthMiddleware, getById);

export default router;
