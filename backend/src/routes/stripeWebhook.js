/**
 * Stripe webhook — registered in index.js with express.raw BEFORE json parser.
 * Requires Fly secret STRIPE_WEBHOOK_SECRET. Verifies signature via stripeService.handleWebhookEvent.
 * Activates/cancels subscriptions in the local store on real Stripe events. Does not fake activation.
 */
import store from '../utils/store.js';
import { handleWebhookEvent } from '../services/stripeService.js';
import { findItem, CATALOG } from '../config/stripeCatalog.js';
import { logger } from '../utils/logger.js';

function priceIdFromSession(session) {
  const fromLine = session?.line_items?.data?.[0]?.price?.id;
  if (fromLine) return fromLine;
  return session?.metadata?.priceId || session?.metadata?.price_id || null;
}

function itemFromSubscription(subscription) {
  const priceId = subscription?.items?.data?.[0]?.price?.id;
  if (priceId) return findItem({ priceId });
  const lookup = subscription?.metadata?.lookup_key || subscription?.metadata?.plan;
  if (lookup) return findItem({ lookup_key: lookup }) || findItem({ id: lookup });
  return null;
}

async function findUserForStripe({ email, userId, customerId }) {
  if (userId) {
    const u = await store.findUserById(userId);
    if (u) return u;
  }
  if (email) {
    const u = await store.findUserByEmail(String(email).toLowerCase());
    if (u) return u;
  }
  if (customerId) {
    const subs = await store.getSubscriptions();
    const hit = subs.find((s) => s.stripeCustomerId === customerId);
    if (hit) {
      const uid = hit.userId || hit.user;
      if (uid) return store.findUserById(uid);
    }
  }
  return null;
}

async function upsertPlanSubscription(user, item, extras = {}) {
  const grant = {
    userId: user.id,
    user: user.id,
    plan: item.id,
    status: extras.status || 'active',
    source: extras.source || 'stripe',
    lookup_key: item.lookup_key,
    stripeSubscriptionId: extras.stripeSubscriptionId || null,
    stripeCustomerId: extras.stripeCustomerId || null,
    stripePriceId: item.priceId,
    currentPeriodEnd: extras.currentPeriodEnd || null,
    unlimited: item.id === 'enterprise',
    expiresAt: null,
  };
  let subscription = (await store.getSubscriptions()).find(
    (s) => s.user === user.id || s.userId === user.id
  );
  if (subscription) {
    subscription = await store.updateSubscription(subscription.id, grant);
  } else {
    subscription = await store.createSubscription(grant);
  }
  await store.updateUser(user.id, {
    plan: item.id,
    stripeCustomerId: extras.stripeCustomerId || user.stripeCustomerId || null,
  });
  return subscription;
}

async function applyCredits(user, item) {
  const next = (user.credits || 0) + (item.credits || 0);
  await store.updateUser(user.id, { credits: next });
  return next;
}

async function cancelLocalSubscription(user, extras = {}) {
  const subscription = (await store.getSubscriptions()).find(
    (s) => s.user === user.id || s.userId === user.id
  );
  if (subscription) {
    return store.updateSubscription(subscription.id, {
      status: 'canceled',
      canceledAt: new Date().toISOString(),
      ...extras,
    });
  }
  return null;
}

export async function stripeWebhookHandler(req, res) {
  const signature = req.headers['stripe-signature'];
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    logger.warn('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set');
    return res.status(503).json({
      error: 'STRIPE_WEBHOOK_SECRET not configured',
      received: false,
    });
  }
  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe-Signature header' });
  }

  let event;
  try {
    event = await handleWebhookEvent(req.body, signature);
  } catch (err) {
    logger.error('Stripe webhook signature verification failed', { error: err.message });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event?.fallback) {
    return res.status(503).json({ error: 'Webhook secret missing', received: false });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_details?.email || session.customer_email;
        const userId = session.client_reference_id || session.metadata?.userId;
        const user = await findUserForStripe({
          email,
          userId,
          customerId: session.customer,
        });
        if (!user) {
          logger.warn('checkout.session.completed: no matching user', { email, userId, sessionId: session.id });
          break;
        }
        let priceId = priceIdFromSession(session);
        if (!priceId && session.metadata?.lookup_key) {
          const byKey = findItem({ lookup_key: session.metadata.lookup_key });
          priceId = byKey?.priceId;
        }
        let item = priceId ? findItem({ priceId }) : null;
        if (!item && session.metadata?.plan) item = findItem({ id: session.metadata.plan });
        if (!item && session.mode === 'subscription') {
          item = CATALOG.plans.find((p) => p.priceId === priceId) || null;
        }
        if (!item) {
          logger.warn('checkout.session.completed: unknown catalog item', { priceId, sessionId: session.id });
          break;
        }
        if (item.interval) {
          await upsertPlanSubscription(user, item, {
            status: 'active',
            source: 'stripe-checkout',
            stripeSubscriptionId: session.subscription || null,
            stripeCustomerId: session.customer || null,
          });
          logger.info('Subscription activated from checkout', { userId: user.id, plan: item.id });
        } else {
          const credits = await applyCredits(user, item);
          logger.info('Credits applied from checkout', { userId: user.id, credits, sku: item.id });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object;
        const item = itemFromSubscription(sub);
        const user = await findUserForStripe({
          userId: sub.metadata?.userId,
          customerId: sub.customer,
          email: sub.metadata?.email,
        });
        if (!user || !item) {
          logger.warn(`${event.type}: missing user or catalog item`, {
            customer: sub.customer,
            priceId: sub.items?.data?.[0]?.price?.id,
          });
          break;
        }
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active'
          : sub.status === 'canceled' ? 'canceled'
            : sub.status;
        await upsertPlanSubscription(user, item, {
          status,
          source: 'stripe-subscription',
          stripeSubscriptionId: sub.id,
          stripeCustomerId: sub.customer,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const user = await findUserForStripe({
          userId: sub.metadata?.userId,
          customerId: sub.customer,
          email: sub.metadata?.email,
        });
        if (user) {
          await cancelLocalSubscription(user, {
            stripeSubscriptionId: sub.id,
            stripeCustomerId: sub.customer,
          });
          logger.info('Subscription canceled from Stripe', { userId: user.id, subId: sub.id });
        }
        break;
      }

      default:
        logger.info('Stripe webhook ignored event type', { type: event.type });
    }

    res.json({ received: true, type: event.type });
  } catch (err) {
    logger.error('Stripe webhook handler error', { error: err.message, type: event?.type });
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

export default stripeWebhookHandler;
