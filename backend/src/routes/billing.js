import express from 'express';
import Stripe from 'stripe';
import store from '../utils/store.js';
import { CATALOG, findItem, publicCatalog } from '../config/stripeCatalog.js';
import { redeemGodCodeForUser, REDEEM_FAIL, normalizeSubscriptionAccess } from '../services/godCodeService.js';

const router = express.Router();

export function getPlans(req, res) {
  res.json(CATALOG.plans);
}

export function getCatalog(req, res) {
  res.json(publicCatalog());
}

export async function checkoutHandler(req, res) {
  const { lookup_key, priceId, id } = req.body || {};
  const item = findItem({ lookup_key, priceId, id });
  if (!item) {
    return res.status(400).json({ error: 'Unknown plan' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.json({ url: item.paymentLink });
  }

  try {
    const stripe = new Stripe(secret);
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const sessionParams = {
      mode: item.interval ? 'subscription' : 'payment',
      line_items: [{ price: item.priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?success=1`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
    };
    if (req.user?.email) {
      sessionParams.customer_email = req.user.email;
    }
    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.json({ url: session.url });
  } catch {
    return res.json({ url: item.paymentLink });
  }
}

router.get('/plans', getPlans);
router.get('/catalog', getCatalog);
router.post('/checkout', checkoutHandler);

router.get('/subscription', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const sub = (await store.getSubscriptions()).find(
    (s) => s.user === req.user.id || s.userId === req.user.id
  );
  res.json((await normalizeSubscriptionAccess(sub)) || { status: 'none' });
});

router.post('/cancel', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const subs = await store.getSubscriptions();
  const sub = subs.find((s) => s.user === req.user.id || s.userId === req.user.id);
  if (sub && typeof store.updateSubscription === 'function') {
    const updated = await store.updateSubscription(sub.id, { status: 'canceled' });
    return res.json(updated || { status: 'canceled' });
  }
  res.json({ status: 'canceled' });
});



router.post('/redeem', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await redeemGodCodeForUser(req.user.id, req.body?.code);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || REDEEM_FAIL });
  }
});

export default router;
