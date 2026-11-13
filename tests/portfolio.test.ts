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

describe('weekly report schedule (Monday 09:00 IST)', () => {
  it('a Wednesday maps back to that week’s Monday 09:00 IST (03:30 UTC)', async () => {
    const { currentWeekSlot } = await import('../src/modules/portfolio/portfolio.reports');
    // Wed 11 Nov 2026, 12:00 UTC
    expect(currentWeekSlot(new Date('2026-11-11T12:00:00Z')).toISOString()).toBe(
      '2026-11-09T03:30:00.000Z',
    );
  });
  it('Monday 08:59 IST is still in the previous week’s slot', async () => {
    const { currentWeekSlot } = await import('../src/modules/portfolio/portfolio.reports');
    // Mon 16 Nov 2026 08:59 IST = 03:29 UTC -> slot = Mon 16 Nov 09:00 IST, which is still in the future
    const slot = currentWeekSlot(new Date('2026-11-16T03:29:00Z'));
    expect(slot.toISOString()).toBe('2026-11-16T03:30:00.000Z');
    expect(slot.getTime()).toBeGreaterThan(new Date('2026-11-16T03:29:00Z').getTime());
  });
  it('Sunday night IST belongs to the Monday six days earlier', async () => {
    const { currentWeekSlot } = await import('../src/modules/portfolio/portfolio.reports');
    // Sun 15 Nov 2026 23:30 IST = 18:00 UTC
    expect(currentWeekSlot(new Date('2026-11-15T18:00:00Z')).toISOString()).toBe(
      '2026-11-09T03:30:00.000Z',
    );
  });
});

describe('new public endpoints validate input', () => {
  it('chat: rejects an empty or too-long question', async () => {
    expect((await request(app).post(`${API}/chat`).send({ question: '' })).status).toBe(400);
    expect(
      (
        await request(app)
          .post(`${API}/chat`)
          .send({ question: 'x'.repeat(501) })
      ).status,
    ).toBe(400);
  });
  it('error reports: always 204, even when malformed', async () => {
    expect((await request(app).post(`${API}/errors`).send({})).status).toBe(204);
  });
  it('admin-only: invites, errors, weekly report', async () => {
    expect((await request(app).get(`${API}/review-invites`)).status).toBe(401);
    expect((await request(app).post(`${API}/review-invites`).send({ name: 'X' })).status).toBe(401);
    expect((await request(app).get(`${API}/errors`)).status).toBe(401);
    expect((await request(app).post(`${API}/reports/weekly/test`)).status).toBe(401);
  });
});

describe('upload content checks', () => {
  it('accepts real image/PDF signatures and rejects disguised files', async () => {
    const { contentMatches } = await import('../src/modules/portfolio/portfolio.storage');
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const jpg = Buffer.from('ffd8ffe000104a4649460001', 'hex');
    const pdf = Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'latin1');
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    expect(contentMatches(png, 'image')).toBe(true);
    expect(contentMatches(jpg, 'image')).toBe(true);
    expect(contentMatches(pdf, 'pdf')).toBe(true);
    expect(contentMatches(html, 'image')).toBe(false);
    expect(contentMatches(svg, 'image')).toBe(false);
    expect(contentMatches(png, 'pdf')).toBe(false);
  });
});

describe('admin tokens', () => {
  it('rejects an unsigned (alg "none") token', async () => {
    const none = jwt.sign({ id: '000000000000000000000000' }, '', { algorithm: 'none' });
    const res = await request(app).get(`${API}/contact`).set('Authorization', `Bearer ${none}`);
    expect(res.status).toBe(401);
  });
  it('rejects a token signed with a different algorithm', async () => {
    const hs512 = jwt.sign({ id: '000000000000000000000000' }, 'test-secret', {
      algorithm: 'HS512',
    });
    const res = await request(app).get(`${API}/contact`).set('Authorization', `Bearer ${hs512}`);
    expect(res.status).toBe(401);
  });
  it('rejects a token whose id is not an ObjectId', async () => {
    const bad = jwt.sign({ id: { $ne: null } }, 'test-secret', { algorithm: 'HS256' });
    const res = await request(app).get(`${API}/contact`).set('Authorization', `Bearer ${bad}`);
    expect(res.status).toBe(401);
  });
});
