import request from 'supertest';
import app from '../index.js';
import userVideoPublisherService from '../services/userVideoPublisherService.js';
import { videoPlatformCatalog } from '../services/videoPlatformCatalog.js';

describe('Per-user social video distribution', () => {
  let token;

  beforeAll(async () => {
    const email = `social-video-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123!',
        firstName: 'Social',
        lastName: 'Video',
      });
    token = res.body.token;
  });

  test('catalog exposes the requested social-video platforms without pretending unsupported APIs exist', async () => {
    const res = await request(app)
      .get('/api/connectors/video-platforms')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.platforms.length).toBe(videoPlatformCatalog.length);

    const ids = new Set(res.body.platforms.map((platform) => platform.id));
    for (const required of [
      'facebook', 'youtube', 'instagram', 'tiktok', 'whatsapp', 'snapchat',
      'x', 'threads', 'reddit', 'pinterest', 'linkedin', 'telegram', 'discord',
      'clapper', 'bluesky', 'twitch', 'bilibili', 'mastodon', 'douyin',
      'warpcast', 'skylight', 'bluescreen', 'reelo',
    ]) {
      expect(ids.has(required)).toBe(true);
    }

    const clapper = res.body.platforms.find((platform) => platform.id === 'clapper');
    expect(clapper.directPublishingReady).toBe(false);
    expect(clapper.connected).toBe(false);

    const youtube = res.body.platforms.find((platform) => platform.id === 'youtube');
    expect(youtube.directPublishingReady).toBe(true);
  });

  test('blocks unsupported direct upload rather than returning fake success', async () => {
    const result = await userVideoPublisherService.publish({
      userId: 'test-user',
      platformId: 'clapper',
      mediaUrl: 'https://example.com/video.mp4',
      caption: 'test',
    });

    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.capability).toBe('no_public_upload_api');
  });

  test('requires a connected user account before direct publishing', async () => {
    const result = await userVideoPublisherService.publish({
      userId: 'unconnected-user',
      platformId: 'youtube',
      mediaUrl: 'https://example.com/video.mp4',
      title: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.error).toMatch(/connect your youtube account/i);
  });
});
