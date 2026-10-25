import express from 'express';
import Stripe from 'stripe';
import {
  activatePaidAdBudget,
  createPaidAdBudget,
  getManagedPaidAdProviders,
  getPaidAdBudget,
  getPlatformFeeBps,
  listPaidAdBudgets,
  markServiceFeeCheckoutCreated,
  paidAdServiceFeeCheckoutPolicy,
  paidAdvertisingLimits,
  updatePaidAdBudget,
} from '../services/paidAdvertisingService.js';
import { listManagedPaidAdAccounts } from '../services/managedPaidAdsProviderService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const budgets = await listPaidAdBudgets(req.user.id);
  res.json({
    budgets,
    policy: {
      serviceFeeBps: getPlatformFeeBps(),
      strictHardStop: true,
      currency: 'usd',
      managedProviders: getManagedPaidAdProviders(),
      ...paidAdvertisingLimits,
    },
  });
});

router.get('/providers/:provider/accounts', async (req, res) => {
  try {
    const accounts = await listManagedPaidAdAccounts(req.user.id, req.params.provider);
    return res.json({
      provider: String(req.params.provider || '').toLowerCase(),
      connected: true,
      accounts,
    });
  } catch (error) {
    return res.status(error.statusCode || 502).json({
      error: error.message || 'Unable to load advertising accounts.',
      code: error.code || 'paid_ads_account_discovery_failed',
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const budget = await createPaidAdBudget({
      userId: req.user.id,
      portfolioProductId: req.body?.portfolioProductId || null,
      provider: req.body?.provider,
      providerAccountId: req.body?.providerAccountId || null,
      campaignConfig: req.body?.campaignConfig || null,
      totalBudgetCents: req.body?.totalBudgetCents,
      enabled: req.body?.enabled,
    });
    res.status(201).json(budget);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create paid advertising budget.', code: error.code || null });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const budget = await updatePaidAdBudget(req.user.id, req.params.id, {
      enabled: req.body?.enabled,
      totalBudgetCents: req.body?.totalBudgetCents,
      providerAccountId: req.body?.providerAccountId,
      campaignConfig: req.body?.campaignConfig,
    });
    if (!budget) return res.status(404).json({ error: 'Paid advertising budget not found.' });
    return res.json(budget);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unable to update paid advertising budget.', code: error.code || null });
  }
});

router.post('/:id/service-fee-checkout', async (req, res) => {
  const budget = await getPaidAdBudget(req.user.id, req.params.id);
  if (!budget) return res.status(404).json({ error: 'Paid advertising budget not found.' });
  if (!budget.enabled) return res.status(400).json({ error: 'Enable paid advertising before checkout.' });
  if (budget.serviceFeePaidAt) return res.json({ alreadyPaid: true, budget });

  const checkoutPolicy = paidAdServiceFeeCheckoutPolicy(budget.provider);
  if (!checkoutPolicy.allowed) {
    return res.status(409).json({
      error: 'The management fee cannot be charged until this provider has an approved managed-billing adapter with verified hard-stop enforcement.',
      code: checkoutPolicy.code,
      budget,
    });
  }

  if (!budget.providerAccountId || !budget.campaignConfig) {
    return res.status(409).json({
      error: 'Select a real advertising account and complete the campaign configuration before checkout.',
      code: 'paid_ads_campaign_configuration_required',
      budget,
    });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(503).json({
      error: 'Stripe is not configured for paid advertising service-fee checkout.',
      code: 'stripe_checkout_not_configured',
    });
  }

  try {
    const stripe = new Stripe(secret);
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: budget.serviceFeeCents,
          product_data: {
            name: 'TrillionAI paid advertising management fee',
            description: `Service fee for a $${(budget.totalBudgetCents / 100).toFixed(2)} all-in paid advertising limit.`,
          },
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/dashboard/paid-ads?fee_paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/paid-ads?fee_canceled=1`,
      client_reference_id: req.user.id,
      customer_email: req.user.email,
      metadata: {
        checkoutType: 'paid_ads_service_fee',
        marketingUserId: req.user.id,
        paidAdBudgetId: budget.id,
      },
    });

    await markServiceFeeCheckoutCreated(req.user.id, budget.id, session.id);
    return res.json({ url: session.url });
  } catch {
    return res.status(502).json({
      error: 'Unable to start paid advertising service-fee checkout.',
      code: 'paid_ads_fee_checkout_failed',
    });
  }
});

router.post('/:id/activate', async (req, res) => {
  const result = await activatePaidAdBudget(req.user.id, req.params.id);
  if (result.error === 'not_found') return res.status(404).json({ error: 'Paid advertising budget not found.' });
  if (result.error === 'disabled') return res.status(400).json({ error: 'Paid advertising is disabled.' });
  if (result.error === 'campaign_configuration_required') {
    return res.status(409).json({
      error: 'Select a real advertising account and complete the campaign configuration before activation.',
      code: 'paid_ads_campaign_configuration_required',
      budget: result.budget,
    });
  }
  if (result.error === 'service_fee_required') {
    return res.status(402).json({
      error: 'The TrillionAI service fee must be paid before paid advertising can be activated.',
      code: 'paid_ads_service_fee_required',
      budget: result.budget,
    });
  }
  if (result.error === 'budget_exhausted') {
    return res.status(409).json({
      error: 'The paid advertising spend limit has been reached.',
      code: 'paid_ads_budget_exhausted',
      budget: result.budget,
    });
  }
  if (result.error === 'provider_adapter_required') {
    return res.status(409).json({
      error: 'Live paid advertising is blocked until this provider has an approved managed-billing adapter with hard-stop enforcement.',
      code: 'paid_ads_provider_adapter_required',
      budget: result.budget,
    });
  }
  return res.json({
    success: true,
    message: 'Budget controls are armed. Provider launch may proceed only through the managed in-app adapter.',
    budget: result.budget,
  });
});

export default router;
