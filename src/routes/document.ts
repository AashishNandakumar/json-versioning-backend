import express from 'express';
import documentController from '../controllers/documentController';
import { authenticateJWT } from '../middlewares/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT as unknown as express.RequestHandler);

// Create a new document
router.post('/', documentController.createDocument as unknown as express.RequestHandler);

// Get all documents (with optional pagination/filtering)
router.get('/', documentController.getDocuments as unknown as express.RequestHandler);

// Get a specific document by ID
router.get('/:id', documentController.getDocumentById as unknown as express.RequestHandler);

// Create a new version for a document
router.post('/:id/versions', documentController.createVersion as unknown as express.RequestHandler);

// Get all versions for a document
router.get('/:id/versions', documentController.getVersions as unknown as express.RequestHandler);

// Get a specific version of a document
router.get('/:id/versions/:versionId', documentController.getVersionById as unknown as express.RequestHandler);

// Merge a version into the current document
router.post('/:id/versions/:versionId/merge', documentController.mergeVersion as unknown as express.RequestHandler);

// Update a document's name
router.patch('/:id', documentController.updateDocumentName as unknown as express.RequestHandler);

// Update the current version of a document (auto-save, no new version)
router.put('/:id/current-version', documentController.updateCurrentVersion as unknown as express.RequestHandler);

// Update a version's content (auto-save)
router.put('/versions/:versionId', documentController.updateVersionContent as unknown as express.RequestHandler);

export default router;
