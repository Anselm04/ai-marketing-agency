import express from 'express';
import store from '../utils/store.js';
import { authenticate } from '../middleware/auth.js';
import { createCustomer, createSubscription, cancelSubscription, createCheckoutSession, getInvoices } from '../services/stripeService.js';

const router = express.Router();
router.use(authenticate);

router.get('/plans', (req, res) => {
  res.json([
    { id: 'starter', name: 'Starter', price: 29, interval: 'monthly', features: { agents: 3, campaigns: 2, postsPerDay: 10, languages: 5, teamSeats: 1, apiAccess: false, whiteLabel: false } },
    { id: 'growth', name: 'Growth', price: 79, interval: 'monthly', features: { agents: 8, campaigns: 10, postsPerDay: 50, languages: 10, teamSeats: 3, apiAccess: true, whiteLabel: false } },
    { id: 'pro', name: 'Pro', price: 199, interval: 'monthly', features: { agents: 14, campaigns: 25, postsPerDay: 100, languages: 20, teamSeats: 10, apiAccess: true, whiteLabel: true } },
    { id: 'enterprise', name: 'Enterprise', price: 499, interval: 'monthly', features: { agents: 99, campaigns: 99, postsPerDay: 500, languages: 99, teamSeats: 99, apiAccess: true, whiteLabel: true } },
  ]);
});

router.get('/subscription', async (req, res) => {
  const sub = (await store.getSubscriptions()).find(s => s.user === req.user.id);
  res.json(sub || { status: 'none' });
});

router.post('/checkout', async (req, res) => {
  const { priceId } = req.body;
  try {
    let sub = (await store.getSubscriptions()).find(s => s.user === req.user.id);
    let customerId;
    if (!sub || !sub.stripeCustomerId) {
      const customer = await createCustomer(req.user.email, `${req.user.profile?.firstName || ''} ${req.user.profile?.lastName || ''}`.trim());
      customerId = customer.id;
      if (!sub) {
        sub = await store.createSubscription({ user: req.user.id, stripeCustomerId: customerId });
      } else {
        sub = await store.updateSubscription(sub.id, { stripeCustomerId: customerId });
      }
    } else {
      customerId = sub.stripeCustomerId;
    }
    const session = await createCheckoutSession(customerId, priceId, `${process.env.APP_URL || 'http://localhost:3000'}/billing/success`, `${process.env.APP_URL || 'http://localhost:3000'}/billing/cancel`);
    res.json({ url: session.url || (session.fallback ? `${process.env.APP_URL || 'http://localhost:3000'}/billing/success` : session.url) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cancel', async (req, res) => {
  const sub = (await store.getSubscriptions()).find(s => s.user === req.user.id);
  if (!sub || !sub.stripeSubscriptionId) return res.status(404).json({ error: 'No active subscription' });
  const result = await cancelSubscription(sub.stripeSubscriptionId);
  const updated = await store.updateSubscription(sub.id, { status: result.status || 'cancelled' });
  res.json({ success: true, subscription: updated });
});

router.get('/invoices', async (req, res) => {
  const sub = (await store.getSubscriptions()).find(s => s.user === req.user.id);
  if (!sub || !sub.stripeCustomerId) return res.json({ data: [] });
  const invoices = await getInvoices(sub.stripeCustomerId);
  res.json(invoices);
});

export default router;
