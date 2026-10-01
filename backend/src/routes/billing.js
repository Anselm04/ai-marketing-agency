import express from 'express';
import Stripe from 'stripe';
import store from '../utils/store.js';
import { hashGodCode } from '../utils/owner.js';
import { CATALOG, findItem, publicCatalog } from '../config/stripeCatalog.js';

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
      metadata: {
        lookup_key: item.lookup_key || '',
        plan: item.id,
        priceId: item.priceId,
        ...(req.user?.id ? { userId: String(req.user.id) } : {}),
      },
    };
    if (req.user?.email) {
      sessionParams.customer_email = req.user.email;
    }
    if (req.user?.id) {
      sessionParams.client_reference_id = String(req.user.id);
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
  res.json(sub || { status: 'none' });
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



const REDEEM_FAIL = 'Unable to redeem that code.';

function resolveGrantItem(found) {
  const sku = found.sku || found.grantType;
  if (sku === 'lifetime') return findItem({ id: 'enterprise' });
  if (sku === 'limited') return findItem({ id: 'growth' });
  return findItem({ id: sku }) || findItem({ lookup_key: found.lookup_key });
}

router.post('/redeem', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const raw = String(req.body?.code || '').trim();
  if (!raw) return res.status(400).json({ error: REDEEM_FAIL });
  let hash;
  try {
    hash = hashGodCode(raw);
  } catch {
    return res.status(400).json({ error: REDEEM_FAIL });
  }
  const found = store.findGodCodeByHash(hash);
  if (!found || found.redeemedAt || found.isUsed || found.redeemedByUserId || found.usedByUserId) {
    return res.status(400).json({ error: REDEEM_FAIL });
  }
  const item = resolveGrantItem(found);
  if (!item) return res.status(400).json({ error: REDEEM_FAIL });

  const now = new Date().toISOString();
  const updated = store.updateGodCode(found.id, {
    encryptedCode: null,
    redeemedAt: now,
    redeemedByUserId: req.user.id,
    isUsed: true,
    usedAt: now,
    usedByUserId: req.user.id,
  });
  if (!updated) return res.status(400).json({ error: REDEEM_FAIL });

  const kind = item.interval ? 'plan' : 'credits';
  const user = await store.findUserById(req.user.id);
  let subscription = (await store.getSubscriptions()).find(
    (s) => s.user === req.user.id || s.userId === req.user.id
  );
  const creditAdd = kind === 'credits' ? (item.credits || 0) : 0;
  const nextCredits = (user?.credits || 0) + creditAdd;

  if (kind === 'plan') {
    const grant = {
      userId: req.user.id,
      user: req.user.id,
      plan: item.id,
      status: 'active',
      source: 'god-code',
      godGrant: item.id,
      lookup_key: item.lookup_key,
      unlimited: item.id === 'enterprise',
      expiresAt: null,
    };
    if (subscription) subscription = await store.updateSubscription(subscription.id, grant);
    else subscription = await store.createSubscription(grant);
  }

  await store.updateUser(req.user.id, {
    godGrant: item.id,
    godRedeemedAt: now,
    credits: nextCredits,
    plan: kind === 'plan' ? item.id : user?.plan,
  });

  res.json({
    success: true,
    sku: item.id,
    grantType: item.id,
    kind,
    name: item.name,
    credits: nextCredits,
    addedCredits: creditAdd,
    subscription: subscription || { status: 'none' },
  });
});

export default router;
