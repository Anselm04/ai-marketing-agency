import { afterEach, describe, expect, test } from '@jest/globals';
import {
  consentStatus,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../services/marketingEmailConsentService.js';

describe('marketing email consent safety', () => {
  afterEach(() => {
    delete process.env.UNSUBSCRIBE_SECRET;
  });

  test('creates and verifies a signed unsubscribe token', () => {
    process.env.UNSUBSCRIBE_SECRET = 'test-unsubscribe-secret';
    const token = createUnsubscribeToken({
      ownerId: 'owner-1',
      leadId: 'lead-1',
      email: 'Person@Example.com',
      now: Date.parse('2026-10-21T00:00:00.000Z'),
    });
    const payload = verifyUnsubscribeToken(token, Date.parse('2026-10-22T00:00:00.000Z'));
    expect(payload).toMatchObject({ ownerId: 'owner-1', leadId: 'lead-1', email: 'person@example.com' });
  });

  test('rejects a tampered unsubscribe token', () => {
    process.env.UNSUBSCRIBE_SECRET = 'test-unsubscribe-secret';
    const token = createUnsubscribeToken({ ownerId: 'owner-1', leadId: 'lead-1', email: 'person@example.com' });
    const [body, signature] = token.split('.');
    expect(() => verifyUnsubscribeToken(`${body}x.${signature}`)).toThrow('Invalid unsubscribe token');
  });

  test('suppression overrides previously granted consent', () => {
    const status = consentStatus({
      email: 'person@example.com',
      marketingConsent: { status: 'granted', source: 'website form' },
      marketingSuppressed: true,
    });
    expect(status.granted).toBe(false);
    expect(status.suppressed).toBe(true);
    expect(status.status).toBe('suppressed');
  });

  test('unknown consent is not sendable', () => {
    expect(consentStatus({ email: 'person@example.com' }).granted).toBe(false);
  });
});
