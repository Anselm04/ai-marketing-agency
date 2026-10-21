import express from 'express';
import { getCustomerUsageSnapshot } from '../services/customerUsageService.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const snapshot = await getCustomerUsageSnapshot(req.user.id);
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

export default router;
