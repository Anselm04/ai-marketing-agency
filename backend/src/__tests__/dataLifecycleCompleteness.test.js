import { describe, expect, test } from '@jest/globals';
import { collectCustomerStorageReferences } from '../services/accountLifecycleService.js';
import { personalInvites, personalOrganizationView, redactSecrets } from '../routes/export.js';

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

  test('exports only the requesting customer membership from shared organization records', () => {
    const organization = {
      id: 'org-1',
      name: 'Shared org',
      ownerId: 'owner-user',
      members: [
        { userId: 'requesting-user', role: 'member', email: 'requesting@example.com' },
        { userId: 'other-user', role: 'admin', email: 'other@example.com' },
      ],
    };

    const exported = personalOrganizationView(organization, 'requesting-user');
    expect(exported).not.toBeNull();
    expect(exported.members).toEqual([
      { userId: 'requesting-user', role: 'member', email: 'requesting@example.com' },
    ]);
    expect(JSON.stringify(exported)).not.toContain('other@example.com');
    expect(exported.membershipExportScope).toBe('requesting_customer_only');
  });

  test('exports only invitations addressed to the requesting customer', () => {
    const user = { id: 'user-1', email: 'Customer@Example.com' };
    const invites = [
      { id: 'mine-email', email: 'customer@example.com', orgId: 'org-1' },
      { id: 'mine-id', userId: 'user-1', email: 'old@example.com', orgId: 'org-2' },
      { id: 'other', email: 'other@example.com', orgId: 'org-1' },
    ];

    expect(personalInvites(invites, user).map((invite) => invite.id)).toEqual(['mine-email', 'mine-id']);
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
