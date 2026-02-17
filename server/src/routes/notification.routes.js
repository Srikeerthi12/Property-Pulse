import { Router } from 'express';

import { authMiddleware } from '../middleware/auth.middleware.js';
import { listNotifications } from '../models/notification.model.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
	const items = await listNotifications(req.auth.sub);
	return res.json({ items });
});

export default router;
