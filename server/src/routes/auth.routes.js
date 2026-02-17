import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { loginRateLimitMiddleware } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/login', loginRateLimitMiddleware(), authController.login);
router.post('/reactivate', loginRateLimitMiddleware(), authController.reactivate);
router.post('/register', authController.register);
router.post('/logout', authController.logout);
router.get('/me', authMiddleware, authController.me);
router.patch('/me', authMiddleware, authController.updateMe);
router.patch('/me/password', authMiddleware, authController.changePassword);
router.patch('/me/deactivate', authMiddleware, authController.deactivateMe);

export default router;
