import express from 'express';
import store from '../utils/store.js';
import agentOrchestrator from '../services/agentOrchestrator.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const agents = store.getAgents().map(a => ({
    ...a,
    status: agentOrchestrator.getAgentStatus(a.agentId) || a.status,
  }));
  res.json(agents);
});

router.get('/tasks', (req, res) => {
  res.json(store.getTasks().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

router.get('/:id', (req, res) => {
  const agent = store.getAgentById(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json({
    ...agent,
    status: agentOrchestrator.getAgentStatus(agent.agentId) || agent.status,
  });
});

router.post('/:id/execute', (req, res) => {
  const agent = store.getAgentById(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const { task, context } = req.body;
  try {
    const result = agentOrchestrator.executeTask(agent.agentId, task || 'General evaluation', context || {});
    store.updateAgent(agent.id, { status: 'active', lastActive: new Date().toISOString() });
    res.json({ success: true, agent: store.getAgentById(req.params.id), task: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;