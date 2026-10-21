import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../services/emailService.js'), 'utf8');

describe('welcome email truthfulness', () => {
  test('does not advertise disabled team collaboration', () => {
    const welcomeSection = source.slice(source.indexOf('export async function sendWelcomeEmail'), source.indexOf('export async function sendCampaignReport'));
    expect(welcomeSection).not.toContain('Inviting your team');
    expect(welcomeSection).toContain('Reviewing generated marketing work before publishing');
  });
});
