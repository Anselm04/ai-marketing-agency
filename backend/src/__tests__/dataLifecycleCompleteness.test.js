import { describe, expect, test } from '@jest/globals';
import { collectCustomerStorageReferences } from '../services/accountLifecycleService.js';
import { redactSecrets } from '../routes/export.js';

describe('customer data lifecycle completeness', () => {
  test('redacts credentials recursively without removing ordinary usage counters', () => {
    const exported = redactSecrets({
      email: 'customer@example.com',
      password: 'never-export-me',
      oauth: {
        accessToken: 'provider-access-token',
        refresh_token: 'provider-refresh-token',
        clientSecret: 'provider-client-secret',
        accountId: 'act_123',
      },
      webhook: {
        signingSecret: 'webhook-secret',
        url: 'https://example.com/hook',
      },
      usage: {
        promptTokens: 100,
        completionTokens: 25,
      },
    });

    expect(exported.email).toBe('customer@example.com');
    expect(exported.password).toBeUndefined();
    expect(exported.oauth.accessToken).toBeUndefined();
    expect(exported.oauth.refresh_token).toBeUndefined();
    expect(exported.oauth.clientSecret).toBeUndefined();
    expect(exported.oauth.accountId).toBe('act_123');
    expect(exported.webhook.signingSecret).toBeUndefined();
    expect(exported.webhook.url).toBe('https://example.com/hook');
    expect(exported.usage.promptTokens).toBe(100);
    expect(exported.usage.completionTokens).toBe(25);
  });

  test('collects top-level and nested objects plus active multipart uploads without duplicates', () => {
    const references = collectCustomerStorageReferences({
      campaigns: [
        {
          upload: {
            status: 'complete',
            key: 'course/customer/source.mp4',
            privateBucket: true,
          },
          clipPlan: {
            clips: [
              { storageKey: 'clipping/customer/campaign/clip-1.mp4' },
              { storageKey: 'clipping/customer/campaign/clip-1.mp4' },
            ],
          },
          renderedLessons: [
            { storageKey: 'courses/customer/lesson-1.mp4' },
          ],
        },
        {
          upload: {
            status: 'uploading',
            key: 'course/customer/in-progress.mp4',
            uploadId: 'upload-123',
            privateBucket: true,
          },
        },
      ],
      content: [
        {
          storageKey: 'media-library/customer/photo.jpg',
          storageVisibility: 'private',
        },
        {
          storageKey: 'media-library/customer/photo.jpg',
          storageVisibility: 'private',
        },
        {
          storageKey: 'media-library/customer/generated/video.mp4',
        },
      ],
    });

    expect(references.objects).toEqual(expect.arrayContaining([
      { key: 'course/customer/source.mp4', privateBucket: true },
      { key: 'clipping/customer/campaign/clip-1.mp4', privateBucket: false },
      { key: 'courses/customer/lesson-1.mp4', privateBucket: false },
      { key: 'media-library/customer/photo.jpg', privateBucket: true },
      { key: 'media-library/customer/generated/video.mp4', privateBucket: false },
    ]));
    expect(references.objects).toHaveLength(5);
    expect(references.multipartUploads).toEqual([
      {
        key: 'course/customer/in-progress.mp4',
        uploadId: 'upload-123',
        privateBucket: true,
      },
    ]);
  });
});
