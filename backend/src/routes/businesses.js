import express from 'express';
import store from '../utils/store.js';
import { createBusinessWorkspaceService } from '../services/businessWorkspaceService.js';

const router = express.Router();
const businesses = createBusinessWorkspaceService(store);

router.get('/', async (req, res, next) => {
  try {
    res.json(await businesses.listBusinesses(req.user.id));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const created = await businesses.createBusiness(req.user.id, req.body || {});
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await businesses.requireOwnedBusiness(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    res.json(await businesses.updateBusiness(req.user.id, req.params.id, req.body || {}));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await businesses.deleteBusiness(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
