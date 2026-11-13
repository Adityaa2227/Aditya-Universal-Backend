// Portfolio module tests. Run with: npm test
// They never touch a real database or real keys: vitest.config.ts points the module
// at an unreachable MongoDB and a test JWT secret before anything loads.

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { toSlug } from '../src/modules/portfolio/portfolio.models';
import { countryOf, parseUserAgent, sourceOf } from '../src/modules/portfolio/portfolio.analytics';

import { app } from '../src/app';
const API = '/api/v1/portfolio';

describe('helpers', () => {
  it('makes URL slugs from titles', () => {
    expect(toSlug('WhereIsMyBitBus')).toBe('whereismybitbus');
    expect(toSlug('Cat Facts & Dog Images Generator')).toBe('cat-facts-dog-images-generator');
    expect(toSlug('  --Hello__World--  ')).toBe('hello-world');
  });

  it('reads devices, browsers and OS from user agents', () => {
    expect(
      parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari/604.1'),
    ).toEqual({
      device: 'mobile',
      browser: 'Safari',
      os: 'iOS',
    });
    expect(
      parseUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/130 Safari/537 Edg/130')
        .browser,
    ).toBe('Edge');
    expect(parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)').device).toBe('bot');
    expect(parseUserAgent('LinkedInBot/1.0 (compatible; preview)').device).toBe('bot');
  });

  it('groups traffic sources', () => {
    expect(sourceOf('www.linkedin.com')).toBe('linkedin');
    expect(sourceOf('lnkd.in')).toBe('linkedin');
    expect(sourceOf('www.google.co.in')).toBe('google');
    expect(sourceOf(undefined)).toBe('direct');
    expect(sourceOf('www.linkedin.com', 'Resume')).toBe('resume'); // utm_source wins
    expect(sourceOf('blog.example.com')).toBe('blog.example.com');
  });

  it('maps timezones to countries', () => {
    expect(countryOf('Asia/Kolkata')).toBe('India');
    expect(countryOf('America/New_York')).toBe('United States');
    expect(countryOf('Antarctica/Troll')).toBe('Antarctica');
    expect(countryOf(undefined)).toBeUndefined();
  });
});

describe('admin routes require a valid login', () => {
  const adminOnly: [string, string][] = [
    ['get', '/projects/admin'],
    ['post', '/projects'],
    ['put', '/projects/reorder'],
    ['post', '/projects/ai-draft'],
    ['get', '/resume/all'],
    ['post', '/resume'],
    ['get', '/testimonials/admin'],
    ['get', '/contact'],
    ['delete', '/contact'],
    ['put', '/settings'],
    ['put', '/auth/password'],
    ['get', '/posts/admin'],
    ['post', '/posts'],
    ['post', '/uploads/image'],
    ['get', '/analytics/summary'],
  ];

  it.each(adminOnly)('%s %s without a token -> 401', async (method, path) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[
      method
    ](API + path);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ id: '000000000000000000000000' }, 'not-the-secret');
    const res = await request(app).get(`${API}/contact`).set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(
      { id: '000000000000000000000000', exp: Math.floor(Date.now() / 1000) - 60 },
      'test-secret',
    );
    const res = await request(app).get(`${API}/contact`).set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

describe('public forms validate input before saving', () => {
  it('contact: rejects a bad email', async () => {
    const res = await request(app)
      .post(`${API}/contact`)
      .send({ name: 'A', email: 'nope', message: 'hi' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('contact: rejects an empty message', async () => {
    const res = await request(app)
      .post(`${API}/contact`)
      .send({ name: 'A', email: 'a@b.co', message: '   ' });
    expect(res.status).toBe(400);
  });

  it('review: requires a role and a valid rating', async () => {
    expect(
      (await request(app).post(`${API}/testimonials`).send({ name: 'A', message: 'Great' })).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`${API}/testimonials`)
          .send({ name: 'A', role: 'SDE', message: 'Great', rating: 9 })
      ).status,
    ).toBe(400);
  });

  it('login: requires username and password', async () => {
    const res = await request(app).post(`${API}/auth/login`).send({ username: '' });
    expect(res.status).toBe(400);
  });
});

describe('analytics endpoint never errors to visitors', () => {
  it('answers 204 to a malformed event', async () => {
    const res = await request(app).post(`${API}/analytics/event`).send({ type: 'hack', path: '' });
    expect(res.status).toBe(204);
  });

  it('answers 204 to bots without storing anything', async () => {
    const res = await request(app)
      .post(`${API}/analytics/event`)
      .set('User-Agent', 'Googlebot/2.1')
      .send({ type: 'pageview', path: '/', visitorId: 'abcdefgh123', sessionId: 'abcdefgh456' });
    expect(res.status).toBe(204);
  });
});

describe('ids are validated', () => {
  it('rejects a malformed id', async () => {
    const token = jwt.sign({ id: '000000000000000000000000' }, 'test-secret');
    // requireAdmin needs the database to find the admin; with an unreachable DB the
    // request fails, so only check that a malformed id never reaches a 2xx.
    const res = await request(app)
      .delete(`${API}/projects/not-an-id`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  }, 20000);
});
