import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { ApiKeyModel } from '../src/modules/apiKey/apiKey.model';
import express, { Request, Response } from 'express';
import { requireApiKey } from '../src/core/middleware/apiKey';
import { sendSuccess } from '../src/core/utils/response';
import { errorHandler } from '../src/core/errors/errorHandler';

describe('API Key System', () => {
  let authToken: string;

  const testUser = {
    name: 'API Key Admin',
    email: 'admin@aditya.dev',
    password: 'PasswordAdmin123',
  };

  const getAuthToken = async (): Promise<string> => {
    if (authToken) return authToken;
    const res = await request(app).post('/api/v1/auth/register').send(testUser);
    authToken = res.body.data.token;
    return authToken;
  };

  it('should create an API key when authenticated and return raw key once', async () => {
    const token = await getAuthToken();

    const res = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Chrome Extension Key',
        project: 'chrome-extension',
        permissions: ['*'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('apiKey');
    expect(res.body.data.apiKey).toMatch(/^ak_live_[a-f0-9]{48}$/);
    expect(res.body.data.keyPrefix).toBe(res.body.data.apiKey.substring(0, 12));

    // Verify raw key is NEVER stored in database
    const dbDoc = await ApiKeyModel.findById(res.body.data.id);
    expect(dbDoc).toBeDefined();
    expect(dbDoc?.keyHash).toBeDefined();
    expect(dbDoc?.keyHash).not.toBe(res.body.data.apiKey);
  });

  it('should list API keys without exposing keyHash or raw key', async () => {
    const token = await getAuthToken();

    await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Dashboard Key',
        project: 'dashboard',
      });

    const res = await request(app)
      .get('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const firstKey = res.body.data[0];
    expect(firstKey).toHaveProperty('keyPrefix');
    expect(firstKey).not.toHaveProperty('keyHash');
    expect(firstKey).not.toHaveProperty('apiKey');
  });

  it('should revoke an API key', async () => {
    const token = await getAuthToken();

    const createRes = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'To Revoke Key',
        project: 'test-project',
      });

    const keyId = createRes.body.data.id;

    const revokeRes = await request(app)
      .delete(`/api/v1/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.success).toBe(true);
    expect(revokeRes.body.data.isRevoked).toBe(true);
  });

  describe('API Key Authentication Middleware', () => {
    // Dedicated test app instance with requireApiKey protected route
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/test-protected', requireApiKey(), (req: Request, res: Response) => {
      sendSuccess(res, { project: req.apiKey?.project }, 'Authorized via API Key');
    });
    testApp.use(errorHandler);

    it('should grant access with a valid active API key', async () => {
      const token = await getAuthToken();

      const createRes = await request(app)
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Access Key',
          project: 'active-app',
        });

      const rawApiKey = createRes.body.data.apiKey;

      const res = await request(testApp)
        .get('/test-protected')
        .set('X-API-Key', rawApiKey);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.project).toBe('active-app');
    });

    it('should reject request when X-API-Key header is missing', async () => {
      const res = await request(testApp).get('/test-protected');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_API_KEY');
    });

    it('should reject request when API key is invalid', async () => {
      const res = await request(testApp)
        .get('/test-protected')
        .set('X-API-Key', 'ak_live_invalid_key_12345');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_API_KEY');
    });

    it('should reject request when API key is revoked', async () => {
      const token = await getAuthToken();

      const createRes = await request(app)
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Revoked Test Key',
          project: 'revoked-app',
        });

      const rawApiKey = createRes.body.data.apiKey;
      const keyId = createRes.body.data.id;

      // Revoke the key
      await request(app)
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`);

      // Try using the revoked key
      const res = await request(testApp)
        .get('/test-protected')
        .set('X-API-Key', rawApiKey);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('API_KEY_REVOKED');
    });
  });
});
