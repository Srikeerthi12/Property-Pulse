import { Router } from 'express';
import * as dealController from '../controllers/deal.controller.js';
import * as dealDocumentsController from '../controllers/dealDocuments.controller.js';
import * as dealNotesController from '../controllers/dealNotes.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { dealDocumentsUpload } from '../middleware/upload.middleware.js';

const router = Router();

router.use(authMiddleware);

// Admin + seller list (admin gets all, seller gets their properties)
router.get('/', dealController.list);

// Buyer
router.get('/my', dealController.listMy);

// Agent
router.get('/agent', dealController.listAgent);

// Create (buyer makes offer; agent/admin may create from inquiry)
router.post('/', dealController.create);

// Updates
router.patch('/:id/status', dealController.updateStatus);
router.patch('/:id/offer', dealController.updateOffer);

// Cancel
router.delete('/:id', dealController.remove);

// Deal documents
router.get('/:id/documents', dealDocumentsController.list);
router.post('/:id/documents', dealDocumentsUpload, dealDocumentsController.upload);
router.delete('/:id/documents/:docId', dealDocumentsController.remove);

// Deal notes
router.get('/:id/notes', dealNotesController.list);
router.post('/:id/notes', dealNotesController.add);

export default router;
