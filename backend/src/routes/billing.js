import express from 'express';
import store from '../utils/store.js';
import { authenticate } from '../middleware/auth.js';
import { createCheckoutSession, handleWebhookEvent, cancelSubscription, getInvoices, stripe } from '../services/stripeService.js';

const router = express.Router();
router.use(authenticate);

// GET /api/billing/purchases — user's product purchase history
router.get('/purchases', async (req, res) => {
  const purchases = await store.getPurchasesByUser(req.user.id);
  res.json(purchases);
});

// POST /api/billing/checkout — create Stripe checkout for a product
router.post('/checkout', async (req, res) => {
  const { productId, purchaseAgreement } = req.body;
  if (!productId) return res.status(400).json({ error: 'Product ID is required' });
  if (!purchaseAgreement) return res.status(400).json({ error: 'You must agree to the purchase terms before proceeding.' });

  const product = await store.getProductById(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!product.price || product.price <= 0) return res.status(400).json({ error: 'This product is not available for purchase.' });

  const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/products/${productId}`;

  try {
    const session = await createCheckoutSession({
      customerEmail: req.user.email,
      lineItems: [{ price: product.stripePriceId, quantity: 1 }],
      mode: product.billingType === 'subscription' || product.billingType === 'monthly' || product.billingType === 'annual' ? 'subscription' : 'payment',
      successUrl,
      cancelUrl,
      metadata: {
        productId: product.id,
        userId: req.user.id,
        purchaseAgreement: 'true',
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/subscriptions — user's active subscriptions
router.get('/subscriptions', async (req, res) => {
  const purchases = await store.getPurchasesByUser(req.user.id);
  const subscriptions = purchases.filter(p => p.billingType === 'subscription' || p.billingType === 'monthly' || p.billingType === 'annual');
  res.json(subscriptions);
});

// POST /api/billing/cancel — cancel a subscription
router.post('/cancel', async (req, res) => {
  const { purchaseId } = req.body;
  if (!purchaseId) return res.status(400).json({ error: 'Purchase ID is required' });

  const purchase = await store.getPurchases().then(p => p.find(p => p.id === purchaseId && p.userId === req.user.id));
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
  if (!purchase.stripeSubscriptionId) return res.status(400).json({ error: 'No active subscription to cancel' });

  try {
    const result = await cancelSubscription(purchase.stripeSubscriptionId);
    await store.updatePurchase(purchaseId, { status: 'cancelled', cancelledAt: new Date().toISOString() });
    res.json({ success: true, status: result.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/refund-request — request a refund
router.post('/refund-request', async (req, res) => {
  const { purchaseId, reason } = req.body;
  if (!purchaseId) return res.status(400).json({ error: 'Purchase ID is required' });

  const purchase = await store.getPurchases().then(p => p.find(p => p.id === purchaseId && p.userId === req.user.id));
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

  const refund = await store.createRefund({
    userId: req.user.id,
    purchaseId,
    stripePaymentIntentId: purchase.stripePaymentIntentId,
    reason: reason || 'Customer request',
    status: 'requested',
  });

  res.json({ success: true, refund });
});

// GET /api/billing/refunds — user's refund requests
router.get('/refunds', async (req, res) => {
  const refunds = await store.getRefunds();
  const userRefunds = refunds.filter(r => r.userId === req.user.id);
  res.json(userRefunds);
});

export default router;
