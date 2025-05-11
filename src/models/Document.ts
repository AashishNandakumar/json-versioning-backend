import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export interface IDocument extends MongooseDocument {
  name: string;
  content: string;
  userId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>({
  name: { type: String, required: true },
  content: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

export default mongoose.model<IDocument>('Document', documentSchema);
