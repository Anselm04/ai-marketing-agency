import { describe, expect, jest, test } from '@jest/globals';
import { getStripeWebhookSecret } from '../services/runtimeSecretService.js';

describe('runtime secret resolution', () => {
  test('prefers the Fly environment webhook secret when configured', async () => {
    const query = jest.fn();
    const secret = await getStripeWebhookSecret({
      env: { STRIPE_WEBHOOK_SECRET: 'whsec_env' },
      query,
    });
    expect(secret).toBe('whsec_env');
    expect(query).not.toHaveBeenCalled();
  });

  test('falls back to the named encrypted Supabase Vault secret', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ decrypted_secret: 'whsec_vault' }] });
    const secret = await getStripeWebhookSecret({
      env: { DATABASE_URL: 'postgresql://example.invalid/db' },
      query,
    });
    expect(secret).toBe('whsec_vault');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('vault.decrypted_secrets'),
      ['marketing_stripe_webhook_secret'],
    );
  });

  test('returns null when neither environment nor Vault can provide the secret', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    await expect(getStripeWebhookSecret({ env: { DATABASE_URL: 'postgresql://example.invalid/db' }, query })).resolves.toBeNull();
  });
});
