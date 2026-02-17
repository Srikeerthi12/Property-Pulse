import { Router } from 'express';
import * as chatController from '../controllers/chat.controller.js';

const router = Router();

router.get('/threads', chatController.listThreads);

export default router;
