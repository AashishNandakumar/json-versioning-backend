import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export interface IVersion extends MongooseDocument {
  documentId: Types.ObjectId;
  content: string;
  isAutoSave: boolean;
  userId?: Types.ObjectId;
  diff?: any;
  mergedFrom?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const versionSchema = new Schema<IVersion>({
  documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
  content: { type: String, required: true },
  isAutoSave: { type: Boolean, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  diff: { type: Schema.Types.Mixed },
  mergedFrom: { type: Schema.Types.ObjectId, ref: 'Version' },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

export default mongoose.model<IVersion>('Version', versionSchema);
