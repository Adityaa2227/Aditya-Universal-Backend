import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Centralized Error Handling', () => {
  it('should return 404 with RESOURCE_NOT_FOUND for non-existent route', async () => {
    const res = await request(app).get('/api/v1/non-existent-route-12345');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.error.message).toContain('Route GET /api/v1/non-existent-route-12345 not found');
  });

  it('should return 400 BAD_REQUEST for malformed JSON request body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "bad json');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.message).toContain('Malformed JSON payload');
  });

  it('should never expose stack trace in error response', async () => {
    const res = await request(app).get('/api/v1/unknown');

    expect(res.body.error).not.toHaveProperty('stack');
  });
});
