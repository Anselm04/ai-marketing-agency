import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import IntegrationRegistry from '../core/IntegrationRegistry.js';
import ConfigManager from '../core/ConfigManager.js';
import integrationService from '../services/integrationService.js';

describe('IntegrationRegistry', () => {
  it('has all expected integrations registered', () => {
    const all = IntegrationRegistry.getAll();
    expect(all.length).toBeGreaterThanOrEqual(28);
    const ids = all.map(i => i.id);
    expect(ids).toContain('twitter');
    expect(ids).toContain('linkedin');
    expect(ids).toContain('instagram');
    expect(ids).toContain('facebook');
    expect(ids).toContain('tiktok');
    expect(ids).toContain('youtube');
    expect(ids).toContain('pinterest');
    expect(ids).toContain('reddit');
    expect(ids).toContain('discord');
    expect(ids).toContain('slack');
    expect(ids).toContain('shopify');
    expect(ids).toContain('wordpress');
    expect(ids).toContain('mailchimp');
    expect(ids).toContain('hubspot');
    expect(ids).toContain('salesforce');
    expect(ids).toContain('stripe');
    expect(ids).toContain('google-ads');
    expect(ids).toContain('meta-ads');
    expect(ids).toContain('notion');
    expect(ids).toContain('airtable');
    expect(ids).toContain('zoom');
    expect(ids).toContain('teams');
    expect(ids).toContain('calendly');
    expect(ids).toContain('etsy');
    expect(ids).toContain('amazon');
    expect(ids).toContain('sendgrid');
    expect(ids).toContain('tiktok-ads');
    expect(ids).toContain('canva');
  });

  it('returns null for unknown integration', () => {
    expect(IntegrationRegistry.get('unknown')).toBeNull();
  });
});

describe('ConfigManager', () => {
  beforeAll(async () => {
    await ConfigManager.setConfig('user-1', 'stripe', { apiKey: 'sk_test_123' });
  });
  afterAll(async () => {
    await ConfigManager.revokeConfig('user-1', 'stripe');
  });

  it('stores and retrieves config', async () => {
    const config = await ConfigManager.getConfig('user-1', 'stripe');
    expect(config).toEqual({ apiKey: 'sk_test_123' });
  });

  it('lists all configs for a user', async () => {
    await ConfigManager.setConfig('user-1', 'mailchimp', { apiKey: 'mc_test' });
    const all = await ConfigManager.getAllForUser('user-1');
    expect(all.length).toBeGreaterThanOrEqual(1);
    await ConfigManager.revokeConfig('user-1', 'mailchimp');
  });

  it('revokes config correctly', async () => {
    await ConfigManager.setConfig('user-1', 'test-int', { token: 'x' });
    await ConfigManager.revokeConfig('user-1', 'test-int');
    const config = await ConfigManager.getConfig('user-1', 'test-int');
    expect(config).toBeNull();
  });
});

describe('IntegrationService', () => {
  it('lists available integrations', async () => {
    const available = await integrationService.listAvailable();
    expect(available.length).toBeGreaterThanOrEqual(28);
    const ids = available.map(i => i.id);
    expect(ids).toContain('stripe');
    expect(ids).toContain('twitter');
  });

  it('connects and disconnects integration', async () => {
    await integrationService.connect('user-2', 'stripe', { apiKey: 'sk_test_abc' });
    const status = await integrationService.getStatus('user-2');
    expect(status.integrations.find(i => i.id === 'stripe').connected).toBe(true);

    await integrationService.disconnect('user-2', 'stripe');
    const statusAfter = await integrationService.getStatus('user-2');
    expect(statusAfter.integrations.find(i => i.id === 'stripe').connected).toBe(false);
  });

  it('generates OAuth URLs for supported integrations', () => {
    expect(integrationService.getOAuthUrl('twitter', 'http://localhost:3000/oauth')).toContain('twitter.com');
    expect(integrationService.getOAuthUrl('linkedin', 'http://localhost:3000/oauth')).toContain('linkedin.com');
    expect(integrationService.getOAuthUrl('unknown', 'http://localhost:3000/oauth')).toBeNull();
  });

  it('returns status with category breakdown', async () => {
    await integrationService.connect('user-3', 'stripe', { apiKey: 'sk_test' });
    await integrationService.connect('user-3', 'twitter', { apiKey: 'tt', accessToken: 'at' });
    const status = await integrationService.getStatus('user-3');
    expect(status.total).toBeGreaterThanOrEqual(28);
    expect(status.connected).toBeGreaterThanOrEqual(2);
    expect(status.categories).toBeInstanceOf(Array);
    expect(status.categories.length).toBeGreaterThan(0);

    await integrationService.disconnect('user-3', 'stripe');
    await integrationService.disconnect('user-3', 'twitter');
  });
});
