import express from 'express';
import store from '../utils/store.js';
import { authenticate } from '../middleware/auth.js';
import crmService from '../services/crmService.js';

const router = express.Router();
router.use(authenticate);

router.get('/leads', (req, res) => {
  const leads = store.getLeads().filter(l => l.owner === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
  res.json(leads);
});

router.post('/leads', (req, res) => {
  const lead = store.createLead({ ...req.body, owner: req.user.id });
  res.status(201).json(lead);
});

router.get('/leads/:id', (req, res) => {
  const lead = store.getLeads().find(l => l.id === req.params.id && l.owner === req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

router.patch('/leads/:id', (req, res) => {
  const lead = store.getLeads().find(l => l.id === req.params.id && l.owner === req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  store.updateLead(lead.id, req.body);
  res.json(store.getLeads().find(l => l.id === req.params.id));
});

router.delete('/leads/:id', (req, res) => {
  const lead = store.getLeads().find(l => l.id === req.params.id && l.owner === req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  store.deleteLead(lead.id);
  res.json({ success: true });
});

router.post('/leads/:id/score', async (req, res) => {
  const result = await crmService.scoreLead(req.params.id);
  res.json(result);
});

router.post('/leads/:id/qualify', async (req, res) => {
  const result = await crmService.autoQualify(req.params.id);
  res.json(result);
});

router.post('/leads/:id/respond', async (req, res) => {
  const result = await crmService.autoRespond(req.params.id);
  res.json(result);
});

router.get('/pipeline', async (req, res) => {
  const pipeline = await crmService.getPipeline(req.user.id);
  res.json(pipeline);
});

router.get('/analytics', async (req, res) => {
  const analytics = await crmService.getAnalytics(req.user.id, parseInt(req.query.days) || 30);
  res.json(analytics);
});

export default router;
