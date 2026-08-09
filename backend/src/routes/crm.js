import express from 'express';
import store from '../utils/store.js';

const router = express.Router();

router.get('/leads', async (req, res) => {
  const leads = (await store.getLeads()).filter(l => l.owner === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
  res.json(leads);
});

router.post('/leads', async (req, res) => {
  const lead = await store.createLead({ ...req.body, owner: req.user.id });
  res.status(201).json(lead);
});

router.get('/leads/:id', async (req, res) => {
  const lead = (await store.getLeads()).find(l => l.id === req.params.id && l.owner === req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

router.patch('/leads/:id', async (req, res) => {
  const lead = (await store.getLeads()).find(l => l.id === req.params.id && l.owner === req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  await store.updateLead(lead.id, req.body);
  res.json((await store.getLeads()).find(l => l.id === req.params.id));
});

router.delete('/leads/:id', async (req, res) => {
  const lead = (await store.getLeads()).find(l => l.id === req.params.id && l.owner === req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  await store.deleteLead(lead.id);
  res.json({ success: true });
});

export default router;
