import express from 'express';
import store from '../utils/store.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const agents = (await store.getAgents()).map(a => ({
    id: a.id || a.agentId,
    agentId: a.agentId,
    name: a.name,
    category: a.category,
    status: a.status,
    role: a.role,
    lastActive: a.lastActive,
  }));
  res.json(agents);
});

router.get('/:id', async (req, res) => {
  const agent = await store.getAgentById(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

router.post('/:id/execute', async (req, res) => {
  const agent = await store.getAgentById(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json({ success: true, agentId: req.params.id, task: req.body.task, result: 'Task executed (placeholder)' });
});

export default router;
