import express from 'express';
import Stripe from 'stripe';
import store from '../utils/store.js';
import { CATALOG, findItem, publicCatalog } from '../config/stripeCatalog.js';
import { redeemGodCodeForUser, REDEEM_FAIL, normalizeSubscriptionAccess } from '../services/godCodeService.js';
import { getMarketingEntitlement } from '../services/marketingEntitlementService.js';

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
    return res.status(503).json({
      error: 'Secure account-linked checkout is not configured yet.',
      code: 'stripe_checkout_unavailable',
    });
  }

  try {
    const stripe = new Stripe(secret);
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    if (!req.user) {
      return res.status(401).json({ error: 'Sign in before starting checkout.' });
    }

    const sessionParams = {
      mode: item.interval ? 'subscription' : 'payment',
      line_items: [{ price: item.priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
      client_reference_id: req.user.id,
      customer_email: req.user.email,
      metadata: {
        userId: req.user.id,
        catalogItemId: item.id,
      },
    };
    if (item.interval) {
      sessionParams.subscription_data = {
        metadata: {
          userId: req.user.id,
          catalogItemId: item.id,
        },
      };
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

router.get('/access', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(await getMarketingEntitlement(req.user));
});

router.post('/sync-checkout', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const sessionId = String(req.body?.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(503).json({ error: 'Stripe checkout is not configured' });
  }

  try {
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.client_reference_id !== req.user.id || session.metadata?.userId !== req.user.id) {
      return res.status(403).json({ error: 'Checkout session does not belong to this account' });
    }

    const item = findItem({ id: session.metadata?.catalogItemId });
    if (!item || !item.interval || session.mode !== 'subscription') {
      return res.status(400).json({ error: 'Checkout session is not a Marketing subscription' });
    }

    const stripeSub = typeof session.subscription === 'object' ? session.subscription : null;
    const stripeStatus = stripeSub?.status || (session.payment_status === 'paid' ? 'active' : 'incomplete');
    const allowedStatuses = new Set(['active', 'trialing']);
    if (!allowedStatuses.has(stripeStatus)) {
      return res.status(402).json({
        error: 'Payment has not produced an active subscription yet.',
        status: stripeStatus,
      });
    }

    const existing = (await store.getSubscriptionsByUser(req.user.id))
      .find((entry) => entry.stripeSubscriptionId === stripeSub?.id)
      || (await store.getSubscriptionsByUser(req.user.id))[0];

    const payload = {
      userId: req.user.id,
      user: req.user.id,
      plan: item.id,
      status: stripeStatus,
      source: 'stripe',
      lookup_key: item.lookup_key,
      stripeSessionId: session.id,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
      stripeSubscriptionId: stripeSub?.id || String(session.subscription || ''),
      expiresAt: null,
      lifetimeAccess: false,
      unlimited: item.id === 'enterprise',
      updatedAt: new Date().toISOString(),
    };

    const subscription = existing
      ? await store.updateSubscription(existing.id, payload)
      : await store.createSubscription(payload);

    return res.json({
      success: true,
      subscription,
      access: await getMarketingEntitlement(req.user),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unable to verify checkout session' });
  }
});

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
