import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const here = dirname(fileURLToPath(import.meta.url));
const workflow = readFileSync(resolve(here, '../../../.github/workflows/deploy-production.yml'), 'utf8');

describe('production deployment contract', () => {
  test('requires Stripe API access and verifies webhook readiness after deploy', () => {
    expect(workflow).toContain('STRIPE_SECRET_KEY');
    expect(workflow).toContain('stripeWebhookVerificationConfigured');
    expect(workflow).toContain('stripeApiConfigured');
  });

  test('requires a real production email transport before Fly deploy', () => {
    expect(workflow).toContain('RESEND_API_KEY');
    expect(workflow).toContain('SENDGRID_API_KEY');
    expect(workflow).toContain('AWS_SES_ACCESS_KEY');
    expect(workflow).toContain('AWS_SES_SECRET_KEY');
    expect(workflow).toContain('SMTP_HOST');
    expect(workflow).toContain('No production email transport is configured.');
  });
});
