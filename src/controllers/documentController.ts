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
      if (!name) return res.status(400).json({ message: 'Name is required' });
      if (!content) return res.status(400).json({ message: 'Content is required' });
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const doc = await Document.create({ name, content, userId: req.user._id });
      // also create a version
      const version = await Version.create({
        documentId: doc._id,
        content,
        isAutoSave: false,
        diff: [],
      });
      return res.status(201).json({
        id: doc._id,
        name: doc.name,
        content: doc.content,
        createdAt: doc.createdAt,
        userId: doc.userId,
      });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to create document', error: err });
    }
  },

  // Get all documents
  async getDocuments(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const docs = await Document.find({ userId: req.user._id }).sort({ createdAt: -1 });
      return res.json(docs.map(doc => ({
        id: doc._id,
        name: doc.name,
        content: doc.content,
        createdAt: doc.createdAt,
        userId: doc.userId,
      })));
    } catch (err) {
      return res.status(500).json({ message: 'Failed to fetch documents', error: err });
    }
  },

  // Get a specific document by ID
  async getDocumentById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid document ID' });
      const doc = await Document.findById(id);
      if (!doc) return res.status(404).json({ message: 'Document not found' });
      return res.json({
        id: doc._id,
        name: doc.name,
        content: doc.content,
        createdAt: doc.createdAt,
      });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to fetch document', error: err });
    }
  },

  // Create a new version for a document
  async createVersion(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { content, isAutoSave } = req.body;
      if (!content) return res.status(400).json({ message: 'Content is required' });
      if (typeof isAutoSave !== 'boolean') return res.status(400).json({ message: 'isAutoSave is required' });
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid document ID' });
      const doc = await Document.findById(id);
      if (!doc) return res.status(404).json({ message: 'Document not found' });
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
      return res.status(500).json({ message: 'Failed to create version', error: err });
    }
  },

  // Get all versions for a document
  async getVersions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid document ID' });
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
      return res.status(500).json({ message: 'Failed to fetch versions', error: err });
    }
  },

  // Get a specific version of a document
  async getVersionById(req: Request, res: Response) {
    try {
      const { id, versionId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(versionId)) return res.status(400).json({ message: 'Invalid ID(s)' });
      const version = await Version.findOne({ _id: versionId, documentId: id });
      if (!version) return res.status(404).json({ message: 'Version not found' });
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
      return res.status(500).json({ message: 'Failed to fetch version', error: err });
    }
  },

  // Merge a version into the current document
  async mergeVersion(req: Request, res: Response) {
    try {
      const { id, versionId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(versionId)) return res.status(400).json({ message: 'Invalid ID(s)' });
      const doc = await Document.findById(id);
      const version = await Version.findOne({ _id: versionId, documentId: id });
      if (!doc || !version) return res.status(404).json({ message: 'Document or version not found' });
      // Update document content
      doc.content = version.content;
      await doc.save();
      // Create a new version representing the merge
      const mergedVersion = await Version.create({
        documentId: doc._id,
        content: version.content,
        isAutoSave: false,
        mergedFrom: version._id,
      });
      return res.json({
        id: doc._id,
        content: doc.content,
        createdAt: doc.createdAt,
        mergedVersionId: mergedVersion._id,
      });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to merge version', error: err });
    }
  },

  // Update a document's name
  async updateDocumentName(req: Request, res: Response) {
    try {
      console.log("Updating document name:", req.params, req.body);
      const { id } = req.params;
      const { name } = req.body;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid document ID' });
      if (!name) return res.status(400).json({ message: 'Name is required' });
      const doc = await Document.findByIdAndUpdate(id, { name }, { new: true });
      if (!doc) return res.status(404).json({ message: 'Document not found' });
      return res.json({
        id: doc._id,
        name: doc.name,
        content: doc.content,
        createdAt: doc.createdAt,
      });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to update document name', error: err });
    }
  },

  // Update the current version of a document (auto-save, no new version)
  async updateCurrentVersion(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid document ID' });
      if (!content) return res.status(400).json({ message: 'Content is required' });
      const doc = await Version.findByIdAndUpdate(id, { content }, { new: true });
      if (!doc) return res.status(404).json({ message: 'Document not found' });
      return res.json({
        id: doc._id,
        documentId: doc.documentId,
        content: doc.content,
        createdAt: doc.createdAt,
        isAutoSave: doc.isAutoSave,
        diff: doc.diff,
      });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to update current version', error: err });
    }
  },

  // Update a version's content (auto-save)
  async updateVersionContent(req: Request, res: Response) {
    console.log("Updating version content:", req.params, req.body);
    try {
      const { versionId } = req.params;
      const { content } = req.body;
      if (!mongoose.Types.ObjectId.isValid(versionId)) return res.status(400).json({ message: 'Invalid version ID' });
      if (!content) return res.status(400).json({ message: 'Content is required' });
      const version = await Version.findByIdAndUpdate(versionId, { content }, { new: true });
      if (!version) return res.status(404).json({ message: 'Version not found' });
      return res.json({
        id: version._id,
        documentId: version.documentId,
        content: version.content,
        isAutoSave: version.isAutoSave,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        diff: version.diff,
        mergedFrom: version.mergedFrom,
      });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to update version content', error: err });
    }
  },
};

export default documentController;
