import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
jest.unstable_mockModule('../middleware/auth.js', () => ({ authenticate: (_req, _res, next) => next() }));
const { default: translation } = await import('../services/translationService.js');
const { default: video } = await import('../services/videoStudio.js');
const { default: translationRoutes } = await import('../routes/translation.js');
const { default: videoRoutes } = await import('../routes/video.js');
const { errorHandler } = await import('../middleware/errorHandler.js');
const app = express(); app.use(express.json());
app.use('/translation', translationRoutes); app.use('/video', videoRoutes); app.use(errorHandler);
afterEach(() => jest.restoreAllMocks());
const routes = [
  ['/translation/translate', translation, 'translate', { content: 'hello', targetLanguage: 'Spanish' }],
  ['/translation/translate-multiple', translation, 'translateToMultiple', { content: 'hello', languages: ['Spanish'] }],
  ['/video/script', video, 'generateScript', { videoType: 'short-form', topic: 'Launch', duration: 30, platform: 'TikTok' }],
  ['/video/storyboard', video, 'generateStoryboard', { script: 'Scene one', style: 'modern' }],
  ['/video/thumbnails', video, 'suggestThumbnails', { topic: 'Launch', brandColors: 'black and gold' }],
  ['/video/hashtags', video, 'suggestHashtags', { topic: 'Launch', platform: 'TikTok' }],
  ['/video/ad', video, 'generateVideoAd', { product: 'Product', audience: 'Customers', duration: 15 }],
];
describe('studio errors reach HTTP clients', () => {
  test.each(routes)('%s returns quota status and code instead of hanging', async (path, service, method, payload) => {
    jest.spyOn(service, method).mockRejectedValue(Object.assign(new Error('AI usage limit reached'), { status: 402, code: 'plan_quota_exceeded' }));
    const response = await request(app).post(path).send(payload).timeout({ response: 300, deadline: 500 });
    expect(response.status).toBe(402);
    expect(response.body.code).toBe('plan_quota_exceeded');
  });
  test('unexpected failures return a sanitized error', async () => {
    jest.spyOn(translation, 'detectLanguage').mockRejectedValue(new Error('private-provider-detail'));
    const response = await request(app).post('/translation/detect').send({ text: 'hello' }).timeout({ response: 300, deadline: 500 });
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
  });
  test('server-side 503 errors do not leak provider details', async () => {
    jest.spyOn(video, 'generateScript').mockRejectedValue(Object.assign(new Error('private-provider-token=abc'), { status: 503 }));
    const response = await request(app).post('/video/script').send({ videoType: 'short-form', topic: 'Launch', duration: 30, platform: 'TikTok' });
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Service temporarily unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('private-provider-token');
  });
  test('video fallback output is rejected by the backend instead of returning HTTP 200', async () => {
    jest.spyOn(video, 'generateScript').mockResolvedValue({ fallback: true, content: '[AI offline] would write a script' });
    const response = await request(app).post('/video/script').send({ videoType: 'short-form', topic: 'Launch', duration: 30, platform: 'TikTok' });
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: 'The AI provider is temporarily unavailable.', code: 'ai_provider_unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('would write a script');
  });
  test('bulk success is preserved beside a quota failure', async () => {
    jest.spyOn(translation, 'translate').mockImplementation(async (_content, language) => {
      if (language === 'Spanish') return { translated: 'Hola', language, fallback: false };
      throw Object.assign(new Error('private quota detail'), { status: 402, code: 'plan_quota_exceeded' });
    });
    const response = await request(app).post('/translation/translate-multiple').send({ content: 'hello', languages: ['Spanish', 'French'] });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ language: 'Spanish', translated: 'Hola', fallback: false }),
      expect.objectContaining({ language: 'French', translated: null, fallback: true, status: 402, errorCode: 'plan_quota_exceeded' }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain('private quota detail');
  });
  test('when no language succeeds a quota rejection remains an HTTP quota error', async () => {
    jest.spyOn(translation, 'translate').mockRejectedValue(Object.assign(new Error('AI usage limit reached'), { status: 402, code: 'plan_quota_exceeded' }));
    const response = await request(app).post('/translation/translate-multiple').send({ content: 'hello', languages: ['Spanish', 'French'] });
    expect(response.status).toBe(402);
    expect(response.body.code).toBe('plan_quota_exceeded');
  });
});
