import { beforeEach, describe, expect, test, jest } from '@jest/globals';

const records = [];
const createContent = jest.fn(async (value) => {
  const record = { id: `wh-${records.length + 1}`, ...value };
  records.push(record);
  return record;
});
const getContentByOwner = jest.fn(async (ownerId) => records.filter((record) => record.owner === ownerId || record.ownerId === ownerId));
const deleteContent = jest.fn(async (id) => {
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) return false;
  records.splice(index, 1);
  return true;
});

jest.unstable_mockModule('../../utils/store.js', () => ({
  default: { createContent, getContentByOwner, deleteContent },
}));
jest.unstable_mockModule('../../utils/owner.js', () => ({
  encryptUtf8: (value) => `encrypted:${value}`,
}));

const {
  createConnectorWebhookRegistration,
  deleteConnectorWebhookRegistration,
  listConnectorWebhookRegistrations,
} = await import('../connectorWebhookRegistryService.js');

beforeEach(() => {
  records.splice(0, records.length);
  jest.clearAllMocks();
});

describe('connector callback registry', () => {
  test('stores a durable local registration without claiming provider registration', async () => {
    const webhook = await createConnectorWebhookRegistration({
      ownerId: 'user-a',
      connectorId: 'discord',
      url: 'https://example.com/webhooks/discord',
      events: ['message.created'],
      secret: 'strong-test-signing-secret-value',
    });

    expect(webhook).toMatchObject({
      connectorId: 'discord',
      localRegistration: true,
      providerRegistered: false,
      secretConfigured: true,
    });
    expect(webhook.secretCipher).toBeUndefined();
    expect(records[0].secretCipher).toBe('encrypted:test-secret-value-at-least-16-characters');
  });

  test('only lists the current owner connector registrations', async () => {
    await createConnectorWebhookRegistration({ ownerId: 'user-a', connectorId: 'discord', url: 'https://a.example.com/hook', events: ['a'] });
    await createConnectorWebhookRegistration({ ownerId: 'user-b', connectorId: 'discord', url: 'https://b.example.com/hook', events: ['b'] });
    await createConnectorWebhookRegistration({ ownerId: 'user-a', connectorId: 'slack', url: 'https://a.example.com/slack', events: ['c'] });

    const rows = await listConnectorWebhookRegistrations('user-a', 'discord');
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe('https://a.example.com/hook');
  });

  test('cannot delete another owners registration', async () => {
    const created = await createConnectorWebhookRegistration({ ownerId: 'user-b', connectorId: 'discord', url: 'https://b.example.com/hook', events: ['b'] });
    await expect(deleteConnectorWebhookRegistration('user-a', 'discord', created.id)).resolves.toBe(false);
    expect(deleteContent).not.toHaveBeenCalled();
  });

  test('rejects non-HTTPS callback destinations', async () => {
    await expect(createConnectorWebhookRegistration({
      ownerId: 'user-a',
      connectorId: 'discord',
      url: 'http://example.com/hook',
      events: ['message.created'],
    })).rejects.toMatchObject({ code: 'connector_webhook_url_invalid' });
  });
});
