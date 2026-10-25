import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import store from '../utils/store.js';
import { mountSocialPart2b } from '../routes/socialPart2b.js';
import { mountSocialPart2a } from '../routes/socialPart2a.js';

const methods = ['getSocialPostById', 'updateSocialPost', 'getSocialPostsByOwner', 'queueSocialPost'];
const originals = Object.fromEntries(methods.map((name) => [name, store[name]]));
const post = { id: 'post-1', owner: 'user-1', platform: 'x', body: 'Saved copy', status: 'draft', published: false };
let app;
beforeEach(() => {
  store.queueSocialPost = jest.fn().mockResolvedValue({ ...post, status: 'queued', published: false, scheduledAt: null, queueMode: 'manual', automaticPublishing: false });
  store.getSocialPostById = jest.fn().mockResolvedValue({ ...post });
  store.updateSocialPost = jest.fn().mockImplementation(async (_id, updates) => ({ ...post, ...updates }));
  store.getSocialPostsByOwner = jest.fn().mockResolvedValue([{ ...post, status: 'queued', scheduledAt: '2026-11-01T12:00:00Z' }]);
  app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'user-1' }; next(); });
  const router = express.Router(); mountSocialPart2a(router); mountSocialPart2b(router); app.use(router);
});
afterEach(() => {
  for (const name of methods) {
    if (originals[name] === undefined) delete store[name];
    else store[name] = originals[name];
  }
});

describe('manual social queue contract', () => {
  test('saves for manual publication without inventing a scheduled time', async () => {
    const response = await request(app).post('/queue').send({ id: post.id });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'queued', queueMode: 'manual', automaticPublishing: false, published: false, scheduledAt: null });
    expect(response.body.message).toMatch(/publish now/i);
    expect(store.queueSocialPost).toHaveBeenCalledWith(post.id, 'user-1');
    expect(store.updateSocialPost).not.toHaveBeenCalled();
  });
  test('rejects a requested schedule rather than promising an unprocessed job', async () => {
    const response = await request(app).post('/queue').send({ id: post.id, scheduledAt: '2026-11-01T12:00:00Z' });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('social_scheduling_unavailable');
    expect(store.updateSocialPost).not.toHaveBeenCalled();
  });
  test('marks legacy queued records as manual in list responses', async () => {
    const response = await request(app).get('/posts');
    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ queueMode: 'manual', automaticPublishing: false });
    expect(store.getSocialPostsByOwner).toHaveBeenCalledWith('user-1');
  });
  test.each(['published', 'publishing'])('does not requeue a %s post', async (status) => {
    store.getSocialPostById.mockResolvedValue({ ...post, status, published: status === 'published' });
    const response = await request(app).post('/queue').send({ id: post.id });
    expect(response.status).toBe(409);
    expect(store.updateSocialPost).not.toHaveBeenCalled();
  });
  test('refuses to overwrite a post that finished publishing after the first read', async () => {
    store.queueSocialPost.mockResolvedValue(null);
    const response = await request(app).post('/queue').send({ id: post.id });
    expect(response.status).toBe(409);
    expect(store.updateSocialPost).not.toHaveBeenCalled();
  });
  test('does not alter a post outside the account', async () => {
    store.getSocialPostById.mockResolvedValue(null);
    expect((await request(app).post('/queue').send({ id: 'other-account-post' })).status).toBe(404);
    expect(store.getSocialPostById).toHaveBeenCalledWith('other-account-post', 'user-1');
    expect(store.updateSocialPost).not.toHaveBeenCalled();
  });
});
