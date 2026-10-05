import crypto from 'crypto';
import { ApiKeyModel, IApiKey } from './apiKey.model';
import { CreateApiKeyInput } from './apiKey.validation';
import { AppError } from '../../core/errors/AppError';

export interface GeneratedApiKeyResponse {
  id: string;
  name: string;
  project: string;
  keyPrefix: string;
  apiKey: string; // ONLY returned upon creation!
  permissions: string[];
  createdAt: Date;
}

export class ApiKeyService {
  public static hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  public static async createApiKey(
    input: CreateApiKeyInput,
    userId?: string,
  ): Promise<GeneratedApiKeyResponse> {
    // Generate secure random key: ak_live_ + 48 hex chars
    const secretPart = crypto.randomBytes(24).toString('hex');
    const rawKey = `ak_live_${secretPart}`;
    const keyPrefix = rawKey.substring(0, 12);
    const keyHash = this.hashKey(rawKey);

    const apiKeyDoc = await ApiKeyModel.create({
      name: input.name,
      project: input.project,
      keyPrefix,
      keyHash,
      permissions: input.permissions || ['*'],
      isRevoked: false,
      createdBy: userId,
    });

    return {
      id: apiKeyDoc._id.toString(),
      name: apiKeyDoc.name,
      project: apiKeyDoc.project,
      keyPrefix: apiKeyDoc.keyPrefix,
      apiKey: rawKey,
      permissions: apiKeyDoc.permissions,
      createdAt: apiKeyDoc.createdAt,
    };
  }

  public static async listApiKeys(project?: string): Promise<IApiKey[]> {
    const filter = project ? { project } : {};
    return ApiKeyModel.find(filter).sort({ createdAt: -1 });
  }

  public static async revokeApiKey(id: string): Promise<IApiKey> {
    const key = await ApiKeyModel.findById(id);
    if (!key) {
      throw AppError.notFound('API Key not found', 'RESOURCE_NOT_FOUND');
    }

    if (key.isRevoked) {
      throw AppError.badRequest('API Key is already revoked', 'BAD_REQUEST');
    }

    key.isRevoked = true;
    await key.save();
    return key;
  }

  public static async validateKey(rawKey: string): Promise<IApiKey> {
    const keyHash = this.hashKey(rawKey);
    const key = await ApiKeyModel.findOne({ keyHash });

    if (!key) {
      throw AppError.unauthorized('Invalid API key', 'INVALID_API_KEY');
    }

    if (key.isRevoked) {
      throw AppError.unauthorized('API key has been revoked', 'API_KEY_REVOKED');
    }

    // Update lastUsedAt asynchronously without blocking request
    ApiKeyModel.updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } }).exec();

    return key;
  }
}
