import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getAllHealthStatus } from '../services/appConnector.js';
import { getConnectorById } from '../services/connectors/index.js';
import { checkUserConnectorHealth } from '../services/connectorUserHealthService.js';

const router = express.Router();

// Mounted before the generic /:id connector routes so /health/all cannot be
// consumed as connector id "health".
router.get('/health/all', authenticate, requireAdmin, (_req, res) => {
  res.json({
    success: true,
    health: getAllHealthStatus(),
    scope: 'provider-process',
    note: 'Customer OAuth authorization is reported by the per-connector health endpoint.',
  });
});

// Customer connection health must be evaluated with that customer's OAuth
// token. A global unauthenticated /me probe is not evidence that an individual
// customer's connection is healthy.
router.get('/:id/health', authenticate, async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found' });
  const health = await checkUserConnectorHealth(req.user?.id || req.userId, connector);
  return res.json({
    success: health.status === 'up' || health.status === 'degraded' || health.status === 'connected_unverified',
    connectorId: connector.id,
    health,
    scope: 'customer-connection',
  });
});

export default router;