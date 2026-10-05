import { Schema, model, Document } from 'mongoose';

export interface IApiKey extends Document {
  name: string;
  project: string;
  keyPrefix: string;
  keyHash: string;
  permissions: string[];
  isRevoked: boolean;
  lastUsedAt?: Date;
  createdBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const apiKeySchema = new Schema<IApiKey>(
  {
    name: {
      type: String,
      required: [true, 'API key name is required'],
      trim: true,
      maxlength: 100,
    },
    project: {
      type: String,
      required: [true, 'Project identifier is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    keyPrefix: {
      type: String,
      required: true,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    permissions: {
      type: [String],
      default: ['*'],
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastUsedAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Record<string, unknown>).keyHash;
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  },
);

export const ApiKeyModel = model<IApiKey>('ApiKey', apiKeySchema);
