import express from 'express';

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
  res.json(agents);
});

router.get('/:id', (req, res) => {
  const agent = agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

router.post('/:id/execute', (req, res) => {
  const agent = agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  agent.status = 'active';
  agent.lastActive = new Date().toISOString();
  res.json({ success: true, agent, task: req.body.task || 'default-task' });
});

export default router;