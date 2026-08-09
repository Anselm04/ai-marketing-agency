import express from 'express';
import agentOrchestrator from '../services/agentOrchestrator.js';

const router = express.Router();

const agents = [
  { id: 'chief-strategy', name: 'Chief Strategy Agent', role: 'Oversees all operations and revenue generation priorities', status: 'active', lastActive: new Date().toISOString() },
  { id: 'social-media', name: 'Social Media Agent', role: 'Creates, schedules, posts, and auto-responds on social platforms', status: 'active', lastActive: new Date().toISOString() },
  { id: 'content', name: 'Content Agent', role: 'Writes articles, ad copy, SEO text, video scripts', status: 'active', lastActive: new Date().toISOString() },
  { id: 'seo-aeo', name: 'SEO/AEO Agent', role: 'Manages Google rank, app store AEO', status: 'idle', lastActive: new Date().toISOString() },
  { id: 'video', name: 'Video Agent', role: 'Generates engaging video ads, animations, tutorials', status: 'active', lastActive: new Date().toISOString() },
  { id: 'legal-compliance', name: 'Legal Compliance Agent', role: 'Reviews all marketing for platform, privacy, ad law compliance', status: 'active', lastActive: new Date().toISOString() },
  { id: 'customer-service', name: 'Customer Service Agent', role: 'Handles inquiries, feedback, FAQs, issues', status: 'idle', lastActive: new Date().toISOString() },
  { id: 'ai-trainer', name: 'AI Trainer Agent', role: 'Keeps all agents learning and adapting from user interactions', status: 'active', lastActive: new Date().toISOString() },
  { id: 'performance-optimizer', name: 'Performance Optimizer', role: 'A/B testing, split testing, and data-driven campaign improvements', status: 'idle', lastActive: new Date().toISOString() },
  { id: 'market-research', name: 'Market Research Agent', role: 'Constantly scans trends and market data for new growth opportunities', status: 'active', lastActive: new Date().toISOString() },
  { id: 'automation-coordinator', name: 'Automation Coordinator', role: 'Ensures all agents act in sync, without conflicts or drift', status: 'active', lastActive: new Date().toISOString() },
  { id: 'agent-oversight', name: 'Agent Oversight AI', role: 'Monitors all agents for focus, teamwork, integrity', status: 'active', lastActive: new Date().toISOString() },
  { id: 'harmony-director', name: 'Harmony Director AI', role: 'Ensures maximum synergy and no wasted effort between agents', status: 'active', lastActive: new Date().toISOString() },
];

router.get('/', (req, res) => {
  res.json(agents.map(a => ({
    ...a,
    status: agentOrchestrator.getAgentStatus(a.id) || a.status,
  })));
});

router.get('/tasks', (req, res) => {
  res.json(agentOrchestrator.getRecentTasks(50));
});

router.get('/:id', (req, res) => {
  const agent = agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json({
    ...agent,
    status: agentOrchestrator.getAgentStatus(agent.id) || agent.status,
  });
});

router.post('/:id/execute', async (req, res) => {
  const agent = agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const { task, context } = req.body;

  try {
    const result = await agentOrchestrator.executeTask(agent.id, task || 'General evaluation', context || {});
    res.json({ success: true, agent: { ...agent, status: 'active', lastActive: new Date().toISOString() }, task: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;