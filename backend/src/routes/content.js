import express from 'express';
import store from '../utils/store.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const content = (await store.getContent()).filter(c => c.owner === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(content);
});

router.post('/', async (req, res) => {
  const content = await store.createContent({ ...req.body, owner: req.user.id });
  res.status(201).json(content);
});

router.get('/:id', async (req, res) => {
  const content = (await store.getContent()).find(c => c.id === req.params.id && c.owner === req.user.id);
  if (!content) return res.status(404).json({ error: 'Content not found' });
  res.json(content);
});

router.patch('/:id', async (req, res) => {
  const content = (await store.getContent()).find(c => c.id === req.params.id && c.owner === req.user.id);
  if (!content) return res.status(404).json({ error: 'Content not found' });
  const updated = await store.updateContent(content.id, req.body);
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const content = (await store.getContent()).find(c => c.id === req.params.id && c.owner === req.user.id);
  if (!content) return res.status(404).json({ error: 'Content not found' });
  await store.deleteContent(content.id);
  res.json({ success: true });
});

export default router;
