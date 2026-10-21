import express from 'express';
import store from '../utils/store.js';
import { getAccessibleAgents, getUserPlanContext } from '../services/planQuotaService.js';

const router = express.Router();

async function planAgents(req) {
  const allAgents = await store.getAgents();
  const context = await getUserPlanContext(req.user?.id || req.userId);
  return { context, accessible: getAccessibleAgents(allAgents, context.limits) };
}

function publicAgent(agent) {
  return {
    id: agent.id || agent.agentId,
    agentId: agent.agentId,
    name: agent.name,
    category: agent.category,
    status: agent.status,
    role: agent.role,
    lastActive: agent.lastActive,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { accessible } = await planAgents(req);
    res.json(accessible.map(publicAgent));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { accessible } = await planAgents(req);
    const agent = accessible.find((item) => String(item.id || item.agentId) === String(req.params.id) || item.agentId === req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found or unavailable on your plan' });
    res.json(agent);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/execute', async (req, res, next) => {
  try {
    const { accessible } = await planAgents(req);
    const agent = accessible.find((item) => String(item.id || item.agentId) === String(req.params.id) || item.agentId === req.params.id);
    if (!agent) return res.status(403).json({ error: 'This AI agent is not available on your current plan', code: 'plan_agent_limit' });
    res.json({ success: true, agentId: agent.agentId || req.params.id, task: req.body.task, result: 'Task executed (placeholder)' });
  } catch (error) {
    next(error);
  }
});

export default router;
