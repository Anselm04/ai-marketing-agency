import express from 'express';
import { getConnectorById } from '../services/connectors/index.js';
import {
  createConnectorWebhookRegistration,
  deleteConnectorWebhookRegistration,
  listConnectorWebhookRegistrations,
} from '../services/connectorWebhookRegistryService.js';

const router = express.Router();

function routeError(res, error, fallback) {
  return res.status(error?.statusCode || 400).json({
    error: error?.message || fallback,
    code: error?.code || 'connector_webhook_registry_error',
    providerRegistered: false,
  });
}

router.post('/:id/webhooks', async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found' });
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
      message: 'Callback registration saved durably in TrillionAI. This does not claim that the external provider registered a webhook. Use a connector-specific provider operation where supported.',
    });
  } catch (error) {
    return routeError(res, error, 'Unable to save webhook callback registration.');
  }
});

router.get('/:id/webhooks', async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found' });
  const webhooks = await listConnectorWebhookRegistrations(req.user.id, connector.id);
  return res.json({ success: true, webhooks, providerRegistered: false });
});

router.delete('/:id/webhooks/:webhookId', async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found' });
  const deleted = await deleteConnectorWebhookRegistration(req.user.id, connector.id, req.params.webhookId);
  if (!deleted) return res.status(404).json({ error: 'Webhook callback registration not found' });
  return res.json({ success: true, deleted: true, providerRegistered: false });
});

export default router;
