import { Request, Response } from 'express';
import Document from '../models/Document';
import Version from '../models/Version';
import jsondiffpatch from 'jsondiffpatch';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth';

const diffPatcher = jsondiffpatch.create({
  objectHash: (obj: any) => obj.id || JSON.stringify(obj),
  propertyFilter: (name: string) => name !== '$hashKey',
});

const documentController = {
  // Create a new document
  async createDocument(req: AuthRequest, res: Response) {
    try {
      const { name, content } = req.body;

      // Validate name
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: 'Name must be a non-empty string.' });
      }
      // Validate content
      if (typeof content !== 'string') {
        return res.status(400).json({ message: 'Content must be a string.' });
      }
      // TODO: Consider adding length limits, e.g., name (max 255 chars), content (max 100,000 chars)

      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const doc = await Document.create({ name, content, userId: req.user._id });
      // also create a version
      const version = await Version.create({
        documentId: doc._id,
        content,
        isAutoSave: false,
        diff: [],
        userId: doc.userId, // Populate userId for the initial version
      });
      return res.status(201).json({
        id: doc._id,
        name: doc.name,
        content: doc.content,
        createdAt: doc.createdAt,
        userId: doc.userId,
      });
    } catch (err) {
      console.error('Error in createDocument:', err);
      return res.status(500).json({ message: 'An internal server error occurred.' });
    }
  },

  // Get all documents
  async getDocuments(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;

      if (page <= 0) {
        return res.status(400).json({ message: 'Page number must be a positive integer.' });
      }
      if (limit <= 0) {
        return res.status(400).json({ message: 'Limit must be a positive integer.' });
      }
      if (limit > 100) { // Optional: Set a max limit
        return res.status(400).json({ message: 'Limit cannot exceed 100.' });
      }

      const skip = (page - 1) * limit;
      const filter = { userId: req.user._id };

      const totalDocuments = await Document.countDocuments(filter);
      if (totalDocuments === 0) {
        return res.json({
          data: [],
          currentPage: page,
          totalPages: 0,
          totalDocuments: 0,
        });
      }
      
      const totalPages = Math.ceil(totalDocuments / limit);

      if (page > totalPages && totalDocuments > 0) { // if totalDocuments is 0, totalPages will be 0. if page is 1, 1 > 0 will be true.
        return res.status(400).json({ message: 'Page number exceeds total pages.' });
      }
      
      const docs = await Document.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      return res.json({
        data: docs.map(doc => ({
          id: doc._id,
          name: doc.name,
          content: doc.content,
          createdAt: doc.createdAt,
          userId: doc.userId,
        })),
        currentPage: page,
        totalPages,
        totalDocuments,
      });
    } catch (err) {
      console.error('Error in getDocuments:', err);
      return res.status(500).json({ message: 'An internal server error occurred.' });
    }
  },

  // Get a specific document by ID
  async getDocumentById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid document ID' });
      const doc = await Document.findById(id);

      if (!doc) return res.status(404).json({ message: 'Document not found' });
      if (!req.user || !doc.userId) return res.status(404).json({ message: 'Document not found or ownership unclear' }); // Should be caught by auth middleware or indicates data issue
      if (doc.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied.' });
      }

      return res.json({
        id: doc._id,
        name: doc.name,
        content: doc.content,
        createdAt: doc.createdAt,
      });
    } catch (err) {
      console.error('Error in getDocumentById:', err);
      return res.status(500).json({ message: 'An internal server error occurred.' });
    }
  },

  // Create a new version for a document
  async createVersion(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { content, isAutoSave } = req.body;

      // Validate content
      if (typeof content !== 'string') {
        return res.status(400).json({ message: 'Content must be a string.' });
      }
      // TODO: Consider adding length limits for content.

      if (typeof isAutoSave !== 'boolean') return res.status(400).json({ message: 'isAutoSave is required and must be a boolean.' });
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid document ID' });
      
      const doc = await Document.findById(id);
      if (!doc) return res.status(404).json({ message: 'Document not found' });

      if (!req.user || !doc.userId) return res.status(403).json({ message: 'Access denied.' }); // Should not happen if doc exists
      if (doc.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied.' });
      }

      // Calculate diff
      let oldContent, newContent;
      try {
        oldContent = JSON.parse(doc.content);
        newContent = JSON.parse(content);
      } catch {
        oldContent = doc.content;
        newContent = content;
      }
      const diff = diffPatcher.diff(oldContent, newContent);
      // Create version
      const version = await Version.create({
        documentId: doc._id,
        content,
        isAutoSave,
        diff,
        userId: doc.userId, // Populate userId for the new version
      });
      console.log('Version created:', version);
      // Update document content
      doc.content = content;
      await doc.save();
      return res.status(201).json({
        id: version._id,
        documentId: version.documentId,
        content: version.content,
        createdAt: version.createdAt,
        isAutoSave: version.isAutoSave,
        diff: version.diff,
      });
    } catch (err) {
      console.error('Error in createVersion:', err);
      return res.status(500).json({ message: 'An internal server error occurred.' });
    }
  },

  // Get all versions for a document
  async getVersions(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid document ID' });

      const doc = await Document.findById(id);
      if (!doc) return res.status(404).json({ message: 'Document not found' });

      if (!req.user || !doc.userId) return res.status(403).json({ message: 'Access denied.' });
      if (doc.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied.' });
      }

      const versions = await Version.find({ documentId: id }).sort({ createdAt: -1 });
      return res.json(versions.map(v => ({
        id: v._id,
        documentId: v.documentId,
        content: v.content,
        createdAt: v.createdAt,
        isAutoSave: v.isAutoSave,
        diff: v.diff,
        mergedFrom: v.mergedFrom,
      })));
    } catch (err) {
      console.error('Error in getVersions:', err);
      return res.status(500).json({ message: 'An internal server error occurred.' });
    }
  },

  // Get a specific version of a document
  async getVersionById(req: AuthRequest, res: Response) {
    try {
      const { id, versionId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(versionId)) return res.status(400).json({ message: 'Invalid ID(s)' });
      
      const version = await Version.findOne({ _id: versionId, documentId: id });
      if (!version) return res.status(404).json({ message: 'Version not found' });

      const doc = await Document.findById(version.documentId);
      if (!doc) return res.status(404).json({ message: 'Parent document not found' });

      if (!req.user || !doc.userId) return res.status(403).json({ message: 'Access denied.' });
      if (doc.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied.' });
      }

      return res.json({
        id: version._id,
        documentId: version.documentId,
        content: version.content,
        createdAt: version.createdAt,
        isAutoSave: version.isAutoSave,
        diff: version.diff,
        mergedFrom: version.mergedFrom,
      });
    } catch (err) {
      console.error('Error in getVersionById:', err);
      return res.status(500).json({ message: 'An internal server error occurred.' });
    }
  },

  // Merge a version into the current document
  async mergeVersion(req: AuthRequest, res: Response) {
    try {
      const { id, versionId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(versionId)) return res.status(400).json({ message: 'Invalid ID(s)' });

      const doc = await Document.findById(id);
      if (!doc) return res.status(404).json({ message: 'Document not found' });

      if (!req.user || !doc.userId) return res.status(403).json({ message: 'Access denied.' });
      if (doc.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied.' });
      }

      const version = await Version.findOne({ _id: versionId, documentId: id });
      if (!version) return res.status(404).json({ message: 'Version not found' });

      // Parent document of version should be the same 'doc', which is already validated
      // No need for an additional check on version.documentId's parent's userId if we trust the DB integrity
      // and that version.documentId indeed points to 'doc'.

      // Update document content
      doc.content = version.content;
      await doc.save();
      // Create a new version representing the merge
      const mergedVersion = await Version.create({
        documentId: doc._id,
        content: version.content,
        isAutoSave: false,
        mergedFrom: version._id,
        userId: doc.userId, // Populate userId for the merged version
      });
      return res.json({
        id: doc._id,
        content: doc.content,
        createdAt: doc.createdAt,
        mergedVersionId: mergedVersion._id,
      });
    } catch (err) {
      console.error('Error in mergeVersion:', err);
      return res.status(500).json({ message: 'An internal server error occurred.' });
    }
  },

  // Update a document's name
  async updateDocumentName(req: AuthRequest, res: Response) {
    try {
      console.log("Updating document name:", req.params, req.body);
      const { id } = req.params;
      const { name } = req.body;

      // Validate name
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: 'Name must be a non-empty string.' });
      }
      // TODO: Consider adding length limits for name.
      
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid document ID' });

      const docToUpdate = await Document.findById(id);
      if (!docToUpdate) return res.status(404).json({ message: 'Document not found' });

      if (!req.user || !docToUpdate.userId) return res.status(403).json({ message: 'Access denied.' });
      if (docToUpdate.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied.' });
      }
      
      docToUpdate.name = name;
      await docToUpdate.save();
      
      return res.json({
        id: docToUpdate._id,
        name: docToUpdate.name,
        content: doc.content,
        createdAt: doc.createdAt,
      });
    } catch (err) {
      console.error('Error in updateDocumentName:', err);
      return res.status(500).json({ message: 'An internal server error occurred.' });
    }
  },

  // Update the current version of a document (auto-save, no new version)
  // Assuming 'id' in req.params is a VERSION id for this specific endpoint logic
  async updateCurrentVersion(req: AuthRequest, res: Response) {
    try {
      const { id: versionId } = req.params; // Renaming for clarity as it's a version ID
      const { content } = req.body;

      // Validate content
      if (typeof content !== 'string') {
        return res.status(400).json({ message: 'Content must be a string.' });
      }
      // TODO: Consider adding length limits for content.

      if (!mongoose.Types.ObjectId.isValid(versionId)) return res.status(400).json({ message: 'Invalid version ID' });

      const versionToUpdate = await Version.findById(versionId);
      if (!versionToUpdate) return res.status(404).json({ message: 'Version not found' });

      const parentDoc = await Document.findById(versionToUpdate.documentId);
      if (!parentDoc) return res.status(404).json({ message: 'Parent document not found' });

      if (!req.user || !parentDoc.userId) return res.status(403).json({ message: 'Access denied.' });
      if (parentDoc.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied.' });
      }

      versionToUpdate.content = content;
      // Note: This endpoint was originally named updateCurrentVersion but seems to update a specific version.
      // It does not create a new version record, just updates the content of an existing one.
      // It also doesn't update the main Document's content field directly here.
      // This behavior is preserved from the original code, only adding auth.
      await versionToUpdate.save();
      
      return res.json({
        id: versionToUpdate._id,
        documentId: versionToUpdate.documentId,
        content: versionToUpdate.content,
        createdAt: versionToUpdate.createdAt,
        isAutoSave: versionToUpdate.isAutoSave,
        diff: versionToUpdate.diff,
      });
    } catch (err) {
      console.error('Error in updateCurrentVersion:', err);
      return res.status(500).json({ message: 'An internal server error occurred.' });
    }
  },

  // Update a version's content (auto-save)
  async updateVersionContent(req: AuthRequest, res: Response) {
    console.log("Updating version content:", req.params, req.body);
    try {
      const { versionId } = req.params;
      const { content } = req.body;

      // Validate content
      if (typeof content !== 'string') {
        return res.status(400).json({ message: 'Content must be a string.' });
      }
      // TODO: Consider adding length limits for content.

      if (!mongoose.Types.ObjectId.isValid(versionId)) return res.status(400).json({ message: 'Invalid version ID' });

      const versionToUpdate = await Version.findById(versionId);
      if (!versionToUpdate) return res.status(404).json({ message: 'Version not found' });

      const parentDoc = await Document.findById(versionToUpdate.documentId);
      if (!parentDoc) return res.status(404).json({ message: 'Parent document not found' });

      if (!req.user || !parentDoc.userId) return res.status(403).json({ message: 'Access denied.' });
      if (parentDoc.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied.' });
      }
      
      versionToUpdate.content = content;
      await versionToUpdate.save();

      return res.json({
        id: versionToUpdate._id,
        documentId: versionToUpdate.documentId,
        content: version.content,
        isAutoSave: version.isAutoSave,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        diff: version.diff,
        mergedFrom: version.mergedFrom,
      });
    } catch (err) {
      console.error('Error in updateVersionContent:', err);
      return res.status(500).json({ message: 'An internal server error occurred.' });
    }
  },
};

export default documentController;
