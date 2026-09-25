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
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { lookup_key, priceId, id } = req.body || {};
  const item = findItem({ lookup_key, priceId, id });
  if (!item) {
    return res.status(400).json({ error: 'Unknown plan' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(503).json({
      error: 'Secure subscription checkout is not configured.',
      code: 'stripe_checkout_not_configured',
    });
  }

  try {
    const stripe = new Stripe(secret);
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const sessionParams = {
      mode: item.interval ? 'subscription' : 'payment',
      line_items: [{ price: item.priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
      client_reference_id: req.user.id,
      metadata: {
        marketingUserId: req.user.id,
        itemId: item.id,
        lookup_key: item.lookup_key,
      },
    };
    sessionParams.customer_email = req.user.email;
    if (item.interval) {
      sessionParams.subscription_data = {
        metadata: {
          marketingUserId: req.user.id,
          itemId: item.id,
          lookup_key: item.lookup_key,
        },
      };
    }
    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.json({ url: session.url });
  } catch {
    return res.status(502).json({
      error: 'Unable to start secure Stripe checkout.',
      code: 'stripe_checkout_failed',
    });
  }
}

async function activateStripePlan({ userId, item, session }) {
  if (!userId || !item?.interval) return null;
  let subscription = (await store.getSubscriptionsByUser(userId))[0] || null;
  const grant = {
    userId,
    user: userId,
    plan: item.id,
    status: 'active',
    source: 'stripe',
    lookup_key: item.lookup_key,
    unlimited: false,
    lifetimeAccess: false,
    accessMode: 'subscription',
    expiresAt: null,
    stripeCustomerId: typeof session?.customer === 'string' ? session.customer : session?.customer?.id || null,
    stripeSubscriptionId: typeof session?.subscription === 'string' ? session.subscription : session?.subscription?.id || null,
    stripeCheckoutSessionId: session?.id || null,
  };
  if (subscription) subscription = await store.updateSubscription(subscription.id, grant);
  else subscription = await store.createSubscription(grant);
  return subscription;
}

export async function stripeWebhookHandler(req, res) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return res.status(503).json({ error: 'Stripe webhook is not configured' });
  }

  let event;
  try {
    const stripe = new Stripe(secret);
    event = stripe.webhooks.constructEvent(
      req.body,
      req.get('stripe-signature'),
      webhookSecret,
    );
  } catch {
    return res.status(400).json({ error: 'Invalid Stripe webhook signature' });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.marketingUserId || session.client_reference_id;
      const item = findItem({
        id: session.metadata?.itemId,
        lookup_key: session.metadata?.lookup_key,
      });
      if (userId && item?.interval && session.payment_status !== 'unpaid') {
        await activateStripePlan({ userId, item, session });
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const stripeSubscription = event.data.object;
      const userId = stripeSubscription.metadata?.marketingUserId;
      if (userId) {
        const subscriptions = await store.getSubscriptionsByUser(userId);
        const current = subscriptions.find(
          (sub) => sub.stripeSubscriptionId === stripeSubscription.id || sub.source === 'stripe',
        );
        if (current) {
          const active = ['active', 'trialing'].includes(stripeSubscription.status);
          await store.updateSubscription(current.id, {
            status: active ? 'active' : stripeSubscription.status,
            stripeSubscriptionId: stripeSubscription.id,
            stripeCustomerId:
              typeof stripeSubscription.customer === 'string'
                ? stripeSubscription.customer
                : stripeSubscription.customer?.id || current.stripeCustomerId,
          });
        }
      }
    }

    return res.json({ received: true });
  } catch {
    return res.status(500).json({ error: 'Unable to process Stripe webhook' });
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
