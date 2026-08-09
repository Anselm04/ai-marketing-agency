import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-20',
});

export async function createCustomer(email, name) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    return { fallback: true, id: `cus_fallback_${Date.now()}` };
  }
  const customer = await stripe.customers.create({ email, name });
  return customer;
}

export async function createSubscription(customerId, priceId, metadata = {}) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    return { fallback: true, id: `sub_fallback_${Date.now()}`, status: 'trialing' };
  }
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata,
    trial_period_days: 14,
  });
  return subscription;
}

export async function cancelSubscription(subscriptionId) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    return { fallback: true, status: 'cancelled' };
  }
  const subscription = await stripe.subscriptions.cancel(subscriptionId);
  return subscription;
}

export async function createCheckoutSession(customerId, priceId, successUrl, cancelUrl) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    return { fallback: true, url: successUrl };
  }
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return session;
}

export async function handleWebhookEvent(payload, signature) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return { fallback: true, received: true };
  }
  const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  return event;
}

export async function getInvoices(customerId) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    return { fallback: true, data: [] };
  }
  const invoices = await stripe.invoices.list({ customer: customerId, limit: 50 });
  return invoices;
}

export async function createUsageRecord(subscriptionItemId, quantity) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    return { fallback: true };
  }
  await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity,
    timestamp: Math.floor(Date.now() / 1000),
  });
}

export { stripe };
