import express from 'express';
import store from '../utils/store.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import metaAgentService from '../services/metaAgentService.js';

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/users', (req, res) => {
  const users = store.getUsers().map(u => { const { password, ...safe } = u; return safe; }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
  res.json(users);
});

router.get('/overview', (req, res) => {
  res.json({
    users: store.getUsers().length,
    campaigns: store.getCampaigns().length,
    agents: store.getAgents().length,
    tasks: store.getTasks().length,
    leads: store.getLeads().length,
    subscriptions: store.getSubscriptions().length,
  });
});

router.get('/meta-agents/review', async (req, res) => {
  const result = await metaAgentService.overseerReview();
  res.json(result);
});

router.get('/meta-agents/optimize', async (req, res) => {
  const result = await metaAgentService.coordinatorOptimize();
  res.json(result);
});

router.get('/meta-agents/health', async (req, res) => {
  const result = await metaAgentService.agentHealthCheck();
  res.json(result);
});

router.post('/meta-agents/retrain/:agentId', async (req, res) => {
  const result = await metaAgentService.retrainAgent(req.params.agentId, req.body.feedback || 'General improvement');
  res.json(result);
});

export default router;
