import express from 'express';
import { getConnectorById } from '../services/connectors/index.js';
import {
  createConnectorWebhookRegistration,
  deleteConnectorWebhookRegistration,
  listConnectorWebhookRegistrations,
} from '../services/connectorWebhookRegistryService.js';

const router = express.Router();

const SAFE_WEBHOOK_CODES = new Set([
  'connector_webhook_url_invalid',
  'connector_webhook_events_required',
  'connector_webhook_secret_invalid',
]);

function routeError(res, error, fallback) {
  const statusCandidate = Number(error?.statusCode || error?.status);
  const status = Number.isInteger(statusCandidate) && statusCandidate >= 400 && statusCandidate <= 499
    ? statusCandidate
    : 400;
  const code = SAFE_WEBHOOK_CODES.has(error?.code)
    ? error.code
    : 'connector_webhook_registry_error';
  const safeMessages = {
    connector_webhook_url_invalid: 'Enter a valid HTTPS callback URL.',
    connector_webhook_events_required: 'Select at least one webhook event.',
    connector_webhook_secret_invalid: 'Use a webhook signing secret between 16 and 512 characters.',
  };
  return res.status(status).json({
    error: safeMessages[code] || fallback,
    code,
    providerRegistered: false,
    deliveryImplemented: false,
  });
}

router.post('/:id/webhooks', async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found', code: 'connector_not_found' });
  try {
    const webhook = await createConnectorWebhookRegistration({
      ownerId: req.user.id,
      connectorId: connector.id,
      url: req.body?.url,
      events: req.body?.events,
      secret: req.body?.secret || null,
    });
    return res.status(201).json({
      success: true,
      webhook,
      providerRegistered: false,
      deliveryImplemented: false,
      message: 'Callback details are stored durably in TrillionAI as a registry only. This does not register a provider webhook and does not claim event delivery. Use a connector-specific provider registration/delivery adapter when one is supported and verified.',
    });
  } catch (error) {
    return routeError(res, error, 'Unable to save webhook callback registration.');
  }
});

router.get('/:id/webhooks', async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found', code: 'connector_not_found' });
  const webhooks = await listConnectorWebhookRegistrations(req.user.id, connector.id);
  return res.json({ success: true, webhooks, providerRegistered: false, deliveryImplemented: false });
});

router.delete('/:id/webhooks/:webhookId', async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found', code: 'connector_not_found' });
  const deleted = await deleteConnectorWebhookRegistration(req.user.id, connector.id, req.params.webhookId);
  if (!deleted) return res.status(404).json({ error: 'Webhook callback registration not found', code: 'connector_webhook_not_found' });
  return res.json({ success: true, deleted: true, providerRegistered: false, deliveryImplemented: false });
});

export { routeError as connectorWebhookRouteError };
export default router;