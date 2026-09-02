import express from 'express';
import { getPlans, getCatalog, checkoutHandler } from './billing.js';

const router = express.Router();

router.get('/plans', getPlans);
router.get('/catalog', getCatalog);
router.post('/checkout', checkoutHandler);

export default router;
