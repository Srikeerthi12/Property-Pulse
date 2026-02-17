import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';

const router = Router();

router.get('/summary', analyticsController.summary);

export default router;
