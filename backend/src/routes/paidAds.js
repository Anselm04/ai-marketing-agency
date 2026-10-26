import express from 'express';
import Stripe from 'stripe';
import {
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
import {
  listManagedPaidAdAccounts,
  requireManagedPaidAdAccount,
} from '../services/managedPaidAdsProviderService.js';
import {
  activateManagedPaidAdBudget,
  disableManagedPaidAdBudget,
  reconcileManagedPaidAdBudget,
} from '../services/paidAdvertisingOrchestratorService.js';
import { validateManagedPaidAdLaunch } from '../services/managedPaidAdsExecutionService.js';
import { majorToMinor, minorToMajor } from '../services/currencyService.js';

const router = express.Router();

function routeError(res, error, fallback = 'Paid advertising operation failed.') {
  const statusCandidate = Number(error?.statusCode || error?.status);
  const code = String(error?.code || 'paid_ads_operation_failed');
  const safeClientError = code.startsWith('paid_ads_')
    && Number.isInteger(statusCandidate)
    && statusCandidate >= 400
    && statusCandidate < 500;
  const status = safeClientError ? statusCandidate : 502;
  return res.status(status).json({
    error: safeClientError ? (error?.message || fallback) : fallback,
    code: safeClientError ? code : 'paid_ads_provider_operation_failed',
  });
}

router.get('/', async (req, res) => {
  const budgets = await listPaidAdBudgets(req.user.id);
  res.json({
    budgets,
    policy: {
      serviceFeeBps: getPlatformFeeBps(),
      strictHardStop: true,
      currencyMode: 'provider_account',
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
    return routeError(res, error, 'Unable to load advertising accounts.');
  }
});

router.post('/', async (req, res) => {
  try {
    const provider = req.body?.provider;
    const providerAccountId = req.body?.providerAccountId || null;
    let totalBudgetMinor = req.body?.totalBudgetCents;

    if (req.body?.totalBudgetMajor != null) {
      const account = providerAccountId
        ? await requireManagedPaidAdAccount(req.user.id, provider, providerAccountId)
        : null;
      const currency = account?.currency || 'USD';
      totalBudgetMinor = majorToMinor(req.body.totalBudgetMajor, currency);
    }

    const budget = await createPaidAdBudget({
      userId: req.user.id,
      portfolioProductId: req.body?.portfolioProductId || null,
      provider,
      providerAccountId,
      campaignConfig: req.body?.campaignConfig || null,
      totalBudgetCents: totalBudgetMinor,
      enabled: req.body?.enabled,
    });
    return res.status(201).json(budget);
  } catch (error) {
    return routeError(res, error, 'Unable to create paid advertising budget.');
  }
});

router.patch('/:id', async (req, res) => {
  try {
    if (req.body?.enabled === false) {
      const budget = await disableManagedPaidAdBudget(req.user.id, req.params.id);
      if (!budget) return res.status(404).json({ error: 'Paid advertising budget not found.' });
      return res.json(budget);
    }

    const current = await getPaidAdBudget(req.user.id, req.params.id);
    if (!current) return res.status(404).json({ error: 'Paid advertising budget not found.' });

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'enabled')) updates.enabled = req.body.enabled;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'providerAccountId')) updates.providerAccountId = req.body.providerAccountId;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'campaignConfig')) updates.campaignConfig = req.body.campaignConfig;

    if (req.body?.totalBudgetMajor != null) {
      let currency = current.currency || current.providerAccount?.currency || 'USD';
      if (req.body?.providerAccountId) {
        const account = await requireManagedPaidAdAccount(req.user.id, current.provider, req.body.providerAccountId);
        currency = account.currency;
      }
      updates.totalBudgetCents = majorToMinor(req.body.totalBudgetMajor, currency);
    } else if (Object.prototype.hasOwnProperty.call(req.body || {}, 'totalBudgetCents')) {
      updates.totalBudgetCents = req.body.totalBudgetCents;
    }

    const budget = await updatePaidAdBudget(req.user.id, req.params.id, updates);
    return res.json(budget);
  } catch (error) {
    return routeError(res, error, 'Unable to update paid advertising budget.');
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
      error: 'The management fee cannot be charged until this provider has an approved managed adapter with verified campaign execution, spend reconciliation and hard-stop enforcement.',
      code: checkoutPolicy.code,
      budget,
    });
  }

  try {
    validateManagedPaidAdLaunch(budget);
  } catch (error) {
    return routeError(res, error, 'Campaign configuration is not ready for provider launch.');
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
    const currency = String(budget.currency || budget.providerAccount?.currency || '').toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) {
      return res.status(409).json({
        error: 'Advertising account currency is not verified, so checkout is blocked.',
        code: 'paid_ads_provider_currency_required',
      });
    }
    const totalMajor = minorToMajor(budget.totalBudgetCents, currency);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency,
          unit_amount: budget.serviceFeeCents,
          product_data: {
            name: 'TrillionAI paid advertising management fee',
            description: `Service fee for a ${totalMajor.toFixed(Math.min(3, budget.currencyExponent ?? 2))} ${currency.toUpperCase()} all-in paid advertising limit.`,
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
        provider: budget.provider,
        providerAccountId: budget.providerAccountId,
        currency: currency.toUpperCase(),
      },
    });

    await markServiceFeeCheckoutCreated(req.user.id, budget.id, session.id);
    return res.json({ url: session.url });
  } catch (error) {
    if (error?.code?.startsWith?.('paid_ads_')) return routeError(res, error);
    return res.status(502).json({
      error: 'Unable to start paid advertising service-fee checkout.',
      code: 'paid_ads_fee_checkout_failed',
    });
  }
});

router.post('/:id/activate', async (req, res) => {
  try {
    const result = await activateManagedPaidAdBudget(req.user.id, req.params.id);
    if (result.error === 'not_found') return res.status(404).json({ error: 'Paid advertising budget not found.' });
    if (result.error === 'disabled') return res.status(400).json({ error: 'Paid advertising is disabled.' });
    if (result.error === 'campaign_configuration_required') {
      return res.status(409).json({ error: 'Select a verified advertising account and complete the campaign configuration before activation.', code: 'paid_ads_campaign_configuration_required', budget: result.budget });
    }
    if (result.error === 'service_fee_required') {
      return res.status(402).json({ error: 'The TrillionAI service fee must be paid before paid advertising can be activated.', code: 'paid_ads_service_fee_required', budget: result.budget });
    }
    if (result.error === 'budget_exhausted') {
      return res.status(409).json({ error: 'The paid advertising spend limit has been reached.', code: 'paid_ads_budget_exhausted', budget: result.budget });
    }
    if (result.error === 'provider_adapter_required') {
      return res.status(409).json({ error: 'Live paid advertising is blocked until this provider is explicitly certified for production use.', code: 'paid_ads_provider_adapter_required', budget: result.budget });
    }
    return res.json({
      success: true,
      message: 'Provider campaign launched with the configured provider-side budget controls.',
      budget: result.budget,
      provider: result.launch,
    });
  } catch (error) {
    return routeError(res, error, 'The advertising provider did not complete campaign launch.');
  }
});

router.post('/:id/reconcile', async (req, res) => {
  try {
    const budget = await reconcileManagedPaidAdBudget(req.user.id, req.params.id);
    if (!budget) return res.status(404).json({ error: 'Paid advertising budget not found.' });
    return res.json({ budget });
  } catch (error) {
    return routeError(res, error, 'Unable to reconcile provider spend.');
  }
});

export { routeError as paidAdsRouteError };
export default router;
