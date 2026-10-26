import store from '../utils/store.js';
import { encryptUtf8 } from '../utils/owner.js';

const KIND = 'connector_callback_registration';

function webhookError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normalizeUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch {
    throw webhookError('Webhook callback URL must be a valid HTTPS URL.', 'connector_webhook_url_invalid');
  }
  if (url.protocol !== 'https:') {
    throw webhookError('Webhook callback URL must use HTTPS.', 'connector_webhook_url_invalid');
  }
  url.username = '';
  url.password = '';
  return url.toString();
}

function normalizeEvents(events) {
  if (!Array.isArray(events)) {
    throw webhookError('Webhook events must be an array.', 'connector_webhook_events_required');
  }
  const values = [...new Set(events.map((event) => String(event || '').trim()).filter(Boolean))].slice(0, 100);
  if (!values.length) throw webhookError('At least one webhook event is required.', 'connector_webhook_events_required');
  return values;
}

function normalizeSecret(secret) {
  if (secret == null || secret === '') return null;
  const value = String(secret);
  if (value.length < 16 || value.length > 512) {
    throw webhookError('Webhook signing secret must be between 16 and 512 characters.', 'connector_webhook_secret_invalid');
  }
  return value;
}

export function publicConnectorWebhook(record) {
  if (!record) return null;
  const { secretCipher, ...safe } = record;
  return {
    ...safe,
    secretConfigured: Boolean(secretCipher),
    localRegistration: true,
    providerRegistered: false,
    deliveryImplemented: false,
    deliveryStatus: 'registry_only',
  };
}

export async function createConnectorWebhookRegistration({ ownerId, connectorId, url, events, secret = null }) {
  if (!ownerId || !connectorId) throw webhookError('Owner and connector are required.', 'connector_webhook_owner_required');
  const normalizedSecret = normalizeSecret(secret);
  const now = new Date().toISOString();
  const record = await store.createContent({
    kind: KIND,
    owner: ownerId,
    ownerId,
    connectorId: String(connectorId),
    url: normalizeUrl(url),
    events: normalizeEvents(events),
    secretCipher: normalizedSecret ? encryptUtf8(normalizedSecret, `connector-webhook:${ownerId}:${connectorId}`) : null,
    providerRegistered: false,
    deliveryImplemented: false,
    registrationScope: 'local_callback_registry',
    createdAt: now,
    updatedAt: now,
  });
  return publicConnectorWebhook(record);
}

export async function listConnectorWebhookRegistrations(ownerId, connectorId) {
  const records = await store.getContentByOwner(ownerId);
  return records
    .filter((item) => item.kind === KIND && String(item.connectorId) === String(connectorId))
    .map(publicConnectorWebhook);
}

export async function deleteConnectorWebhookRegistration(ownerId, connectorId, webhookId) {
  const records = await store.getContentByOwner(ownerId);
  const record = records.find((item) => (
    item.kind === KIND
    && String(item.connectorId) === String(connectorId)
    && String(item.id) === String(webhookId)
  ));
  if (!record) return false;
  await store.deleteContent(record.id);
  return true;
}

export { KIND as CONNECTOR_WEBHOOK_KIND };
export default {
  createConnectorWebhookRegistration,
  deleteConnectorWebhookRegistration,
  listConnectorWebhookRegistrations,
  publicConnectorWebhook,
};