import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getAllHealthStatus } from '../services/appConnector.js';

const router = express.Router();

// Mounted before the generic /:id connector routes so /health/all cannot be
// consumed as connector id "health".
router.get('/health/all', authenticate, requireAdmin, (_req, res) => {
  res.json({ success: true, health: getAllHealthStatus() });
});

export default router;
