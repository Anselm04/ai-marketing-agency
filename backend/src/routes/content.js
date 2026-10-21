import express from 'express';
import store from '../utils/store.js';
import { createBusinessWorkspaceService } from '../services/businessWorkspaceService.js';

const router = express.Router();
const businesses = createBusinessWorkspaceService(store);

router.get('/', async (req, res, next) => {
  try {
    const businessId = req.query.businessId ? String(req.query.businessId) : null;
    if (businessId) await businesses.requireOwnedBusiness(req.user.id, businessId);
    const content = businesses.filterByBusiness(
      await store.getContentByOwner(req.user.id),
      businessId,
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(content);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const safeInput = { ...(req.body || {}) };
    delete safeInput.owner;
    delete safeInput.ownerId;
    if (safeInput.businessId) await businesses.requireOwnedBusiness(req.user.id, safeInput.businessId);
    const content = await store.createContent({ ...safeInput, owner: req.user.id });
    res.status(201).json(content);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res) => {
  const content = (await store.getContentByOwner(req.user.id)).find(c => c.id === req.params.id);
  if (!content) return res.status(404).json({ error: 'Content not found' });
  res.json(content);
});

router.patch('/:id', async (req, res, next) => {
  try {
    const content = (await store.getContentByOwner(req.user.id)).find(c => c.id === req.params.id);
    if (!content) return res.status(404).json({ error: 'Content not found' });
    const safeInput = { ...(req.body || {}) };
    delete safeInput.owner;
    delete safeInput.ownerId;
    if (safeInput.businessId) await businesses.requireOwnedBusiness(req.user.id, safeInput.businessId);
    const updated = await store.updateContent(content.id, safeInput);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res) => {
  const content = (await store.getContentByOwner(req.user.id)).find(c => c.id === req.params.id);
  if (!content) return res.status(404).json({ error: 'Content not found' });
  await store.deleteContent(content.id);
  res.json({ success: true });
});

export default router;
