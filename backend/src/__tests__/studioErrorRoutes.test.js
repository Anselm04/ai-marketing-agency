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
  ['/translation/translate', translation, 'translate'],
  ['/translation/translate-multiple', translation, 'translateToMultiple'],
  ['/video/script', video, 'generateScript'], ['/video/storyboard', video, 'generateStoryboard'],
  ['/video/thumbnails', video, 'suggestThumbnails'], ['/video/hashtags', video, 'suggestHashtags'], ['/video/ad', video, 'generateVideoAd'],
];
describe('studio errors reach HTTP clients', () => {
  test.each(routes)('%s returns quota status and code instead of hanging', async (path, service, method) => {
    jest.spyOn(service, method).mockRejectedValue(Object.assign(new Error('AI usage limit reached'), { status: 402, code: 'plan_quota_exceeded' }));
    const response = await request(app).post(path).send({}).timeout({ response: 300, deadline: 500 });
    expect(response.status).toBe(402);
    expect(response.body.code).toBe('plan_quota_exceeded');
  });
  test('unexpected failures return a sanitized error', async () => {
    jest.spyOn(translation, 'detectLanguage').mockRejectedValue(new Error('private-provider-detail'));
    const response = await request(app).post('/translation/detect').send({ text: 'hello' }).timeout({ response: 300, deadline: 500 });
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
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
