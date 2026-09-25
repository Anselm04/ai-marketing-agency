import express from 'express';
import { getPlans, getCatalog } from './billing.js';

const router = express.Router();

router.get('/plans', getPlans);
router.get('/catalog', getCatalog);

export default router;
