import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

function requireStripeSecret() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    const error = new Error('Stripe is not configured. STRIPE_SECRET_KEY is required.');
    error.code = 'stripe_not_configured';
    throw error;
  }
  return secret;
}

function stripeClient() {
  return new Stripe(requireStripeSecret(), { apiVersion: '2024-06-20' });
}

export async function createCustomer(email, name) {
  return stripeClient().customers.create({ email, name });
}

export async function createSubscription(customerId, priceId, metadata = {}) {
  return stripeClient().subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata,
    trial_period_days: 14,
  });
}

export async function cancelSubscription(subscriptionId, { immediate = false } = {}) {
  const stripe = stripeClient();
  if (immediate) return stripe.subscriptions.cancel(subscriptionId);
  return stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

export async function resumeSubscription(subscriptionId) {
  return stripeClient().subscriptions.update(subscriptionId, { cancel_at_period_end: false });
}

export async function createCheckoutSession(customerId, priceId, successUrl, cancelUrl) {
  return stripeClient().checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function handleWebhookEvent(payload, signature) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    const error = new Error('Stripe webhook is not configured. STRIPE_WEBHOOK_SECRET is required.');
    error.code = 'stripe_webhook_not_configured';
    throw error;
  }
  return stripeClient().webhooks.constructEvent(payload, signature, webhookSecret);
}

export async function getInvoices(customerId) {
  return stripeClient().invoices.list({ customer: customerId, limit: 50 });
}

export async function createUsageRecord(subscriptionItemId, quantity) {
  return stripeClient().subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity,
    timestamp: Math.floor(Date.now() / 1000),
  });
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export { stripeClient };
