import express from 'express';
import Stripe from 'stripe';
import store from '../utils/store.js';
import { CATALOG, findItem, publicCatalog } from '../config/stripeCatalog.js';
import { redeemGodCodeForUser, REDEEM_FAIL, normalizeSubscriptionAccess } from '../services/godCodeService.js';
import { markServiceFeePaid } from '../services/paidAdvertisingService.js';
import { cancelSubscription, resumeSubscription } from '../services/stripeService.js';
import {
  claimStripeWebhookEvent,
  grantUserCredits,
  releaseStripeWebhookEvent,
} from '../services/billingPersistence.js';

const router = express.Router();

function stripeTimestamp(value) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function stripeSubscriptionPatch(stripeSubscription, current = {}) {
  const active = ['active', 'trialing'].includes(stripeSubscription.status);
  return {
    status: active ? 'active' : stripeSubscription.status,
    stripeSubscriptionId: stripeSubscription.id,
    stripeCustomerId:
      typeof stripeSubscription.customer === 'string'
        ? stripeSubscription.customer
        : stripeSubscription.customer?.id || current.stripeCustomerId || null,
    cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
    currentPeriodEnd: stripeTimestamp(stripeSubscription.current_period_end),
    canceledAt: stripeTimestamp(stripeSubscription.canceled_at),
    endedAt: stripeTimestamp(stripeSubscription.ended_at),
  };
}

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
  if (!item) return res.status(400).json({ error: 'Unknown plan' });

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
      customer_email: req.user.email,
      metadata: {
        marketingUserId: req.user.id,
        itemId: item.id,
        lookup_key: item.lookup_key,
      },
    };
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
    cancelAtPeriodEnd: false,
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
    event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), webhookSecret);
  } catch {
    return res.status(400).json({ error: 'Invalid Stripe webhook signature' });
  }

  let claimed = false;
  try {
    claimed = await claimStripeWebhookEvent(event.id, event.type);
    if (!claimed) return res.json({ received: true, duplicate: true });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.marketingUserId || session.client_reference_id;
      if (
        session.metadata?.checkoutType === 'paid_ads_service_fee'
        && userId
        && session.metadata?.paidAdBudgetId
        && session.payment_status === 'paid'
      ) {
        await markServiceFeePaid({
          userId,
          budgetId: session.metadata.paidAdBudgetId,
          sessionId: session.id,
        });
      } else {
        const item = findItem({
          id: session.metadata?.itemId,
          lookup_key: session.metadata?.lookup_key,
        });
        if (userId && item?.interval && session.payment_status !== 'unpaid') {
          await activateStripePlan({ userId, item, session });
        } else if (userId && !item?.interval && item?.credits && session.payment_status === 'paid') {
          await grantUserCredits(userId, item.credits);
        }
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
          await store.updateSubscription(current.id, stripeSubscriptionPatch(stripeSubscription, current));
        }
      }
    }

    return res.json({ received: true });
  } catch {
    if (claimed) {
      try {
        await releaseStripeWebhookEvent(event.id);
      } catch {
        // Preserve the original processing failure response. A stuck event can be reconciled from Stripe history.
      }
    }
    return res.status(500).json({ error: 'Unable to process Stripe webhook' });
  }
}

router.get('/plans', getPlans);
router.get('/catalog', getCatalog);
router.post('/checkout', checkoutHandler);

router.get('/subscription', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const sub = (await store.getSubscriptions()).find(
    (s) => s.user === req.user.id || s.userId === req.user.id,
  );
  res.json((await normalizeSubscriptionAccess(sub)) || { status: 'none' });
});

router.post('/cancel', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const sub = (await store.getSubscriptionsByUser(req.user.id))[0] || null;
  if (!sub) return res.status(404).json({ error: 'No subscription found.' });
  if (sub.source !== 'stripe') {
    return res.status(409).json({
      error: 'This access grant is not a Stripe subscription and cannot be canceled through Stripe.',
      code: 'not_stripe_subscription',
    });
  }
  if (!sub.stripeSubscriptionId) {
    return res.status(409).json({
      error: 'Stripe subscription identifier is missing; cancellation was not attempted.',
      code: 'stripe_subscription_id_missing',
    });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: 'Stripe is not configured; cancellation was not attempted.',
      code: 'stripe_not_configured',
    });
  }

  try {
    const stripeSubscription = await cancelSubscription(sub.stripeSubscriptionId);
    const updated = await store.updateSubscription(
      sub.id,
      stripeSubscriptionPatch(stripeSubscription, sub),
    );
    return res.json(updated);
  } catch {
    return res.status(502).json({
      error: 'Stripe did not confirm the cancellation request. Your local subscription was not changed.',
      code: 'stripe_cancel_failed',
    });
  }
});

router.post('/resume', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const sub = (await store.getSubscriptionsByUser(req.user.id))[0] || null;
  if (!sub || sub.source !== 'stripe' || !sub.stripeSubscriptionId) {
    return res.status(409).json({ error: 'No resumable Stripe subscription found.' });
  }
  if (!sub.cancelAtPeriodEnd) return res.json(sub);
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured.', code: 'stripe_not_configured' });
  }

  try {
    const stripeSubscription = await resumeSubscription(sub.stripeSubscriptionId);
    const updated = await store.updateSubscription(
      sub.id,
      stripeSubscriptionPatch(stripeSubscription, sub),
    );
    return res.json(updated);
  } catch {
    return res.status(502).json({
      error: 'Stripe did not confirm the resume request. Your local subscription was not changed.',
      code: 'stripe_resume_failed',
    });
  }
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
