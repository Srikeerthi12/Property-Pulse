import { Router } from 'express';
import * as requirementController from '../controllers/requirement.controller.js';

const router = Router();

router.get('/', requirementController.list);

export default router;
