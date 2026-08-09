import express from 'express';
import store from '../utils/store.js';
import agentOrchestrator from '../services/agentOrchestrator.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const agents = (await store.getAgents()).map(a => ({
    ...a,
    status: agentOrchestrator.getAgentStatus(a.agentId) || a.status,
  }));
  res.json(agents);
});

router.get('/tasks', async (req, res) => {
  res.json((await store.getTasks()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

router.get('/:id', async (req, res) => {
  const agent = await store.getAgentById(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json({
    ...agent,
    status: agentOrchestrator.getAgentStatus(agent.agentId) || agent.status,
  });
});

router.post('/:id/execute', async (req, res) => {
  const agent = await store.getAgentById(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const { task, context } = req.body;
  try {
    const result = await agentOrchestrator.executeTask(agent.agentId, task || 'General evaluation', context || {});
    await store.updateAgent(agent.id, { status: 'active', lastActive: new Date().toISOString() });
    res.json({ success: true, agent: await store.getAgentById(req.params.id), task: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;