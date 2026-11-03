import express from 'express';
import Stripe from 'stripe';
import store from '../utils/store.js';
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
import {
  AUTHORIZATION_VERSION,
  normalizeSpendAuthorization,
  paidAdAuthorizationModes,
  summarizeAuthorizedCosts,
} from '../services/paidAdAuthorizationService.js';

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
      authorizationVersion: AUTHORIZATION_VERSION,
      authorizationModes: paidAdAuthorizationModes,
      reauthenticationMethods: ['password'],
      automaticBudgetIncreaseAllowed: false,
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
    if (req.body?.enabled === true && (!providerAccountId || !req.body?.campaignConfig)) {
      return res.status(400).json({
        error: 'A verified advertising account and campaign configuration are required before enabling paid advertising.',
        code: 'paid_ads_campaign_configuration_required',
      });
    }
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

router.post('/:id/authorize', async (req, res) => {
  const budget = await getPaidAdBudget(req.user.id, req.params.id);
  if (!budget) return res.status(404).json({ error: 'Paid advertising budget not found.' });

  if (req.body?.acceptedAuthorizationTerms !== true) {
    return res.status(400).json({
      error: 'Confirm that you understand and authorize the displayed spending limits and cost breakdown.',
      code: 'paid_ads_authorization_terms_required',
    });
  }

  const password = String(req.body?.password || '');
  if (!password) {
    return res.status(400).json({
      error: 'Re-enter your account password to authorize paid advertising.',
      code: 'paid_ads_reauthentication_required',
    });
  }

  const user = await store.findUserById(req.user.id);
  if (!user?.password) {
    return res.status(409).json({
      error: 'This account does not currently have password re-authentication available. Paid advertising cannot be started until a supported strong re-authentication method is configured.',
      code: 'paid_ads_reauthentication_unavailable',
    });
  }
  if (!(await store.comparePassword(password, user.password))) {
    return res.status(401).json({
      error: 'Password confirmation failed.',
      code: 'paid_ads_reauthentication_failed',
    });
  }

  const expectedMajor = minorToMajor(budget.totalBudgetCents, budget.currency);
  if (Number(req.body?.confirmedTotalBudgetMajor) !== expectedMajor) {
    return res.status(409).json({
      error: `Confirm the exact maximum total exposure of ${expectedMajor} ${budget.currency} before starting.`,
      code: 'paid_ads_total_exposure_confirmation_mismatch',
    });
  }

  try {
    const dailyMediaSpendCapCents = req.body?.dailyMediaSpendCapMajor != null
      ? majorToMinor(req.body.dailyMediaSpendCapMajor, budget.currency)
      : Number(req.body?.dailyMediaSpendCapCents);
    const authorization = normalizeSpendAuthorization({
      mode: req.body?.mode,
      totalBudgetCents: budget.totalBudgetCents,
      mediaSpendCapCents: budget.mediaSpendCapCents,
      dailyMediaSpendCapCents,
      currency: budget.currency,
      confirmedAt: new Date().toISOString(),
      reauthMethod: 'password',
    });
    const costSummary = summarizeAuthorizedCosts({
      totalBudgetCents: budget.totalBudgetCents,
      serviceFeeCents: budget.serviceFeeCents,
      mediaSpendCapCents: budget.mediaSpendCapCents,
      otherThirdPartyCostsCents: 0,
      currency: budget.currency,
    });

    const authorizationEvent = {
      version: authorization.version,
      confirmedAt: authorization.confirmedAt,
      mode: authorization.mode,
      maxTotalBudgetCents: authorization.maxTotalBudgetCents,
      maxMediaSpendCents: authorization.maxMediaSpendCents,
      dailyMediaSpendCapCents: authorization.dailyMediaSpendCapCents,
      currency: authorization.currency,
      reauthMethod: authorization.reauthMethod,
      termsAccepted: true,
    };
    const history = Array.isArray(budget.authorizationHistory) ? budget.authorizationHistory : [];
    const updated = await store.updateContent(budget.id, {
      spendAuthorization: authorizationEvent,
      authorizationHistory: [...history, authorizationEvent],
      authorizedCostSummary: costSummary,
      enabled: true,
      status: budget.serviceFeePaidAt ? (budget.providerCampaignId ? 'active' : 'ready') : 'service_fee_required',
      pausedAt: null,
      hardStopReason: null,
      updatedAt: new Date().toISOString(),
    });
    return res.json({
      success: true,
      budget: updated,
      authorization: authorizationEvent,
      costSummary,
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message || 'Paid advertising authorization is invalid.',
      code: error.code || 'paid_ads_authorization_invalid',
    });
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

    if (req.body?.enabled === true && !current.spendAuthorization) {
      return res.status(409).json({
        error: 'Authorize the exact spending limits before enabling paid advertising.',
        code: 'paid_ads_authorization_required',
      });
    }

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
  if (!budget.enabled || !budget.spendAuthorization) {
    return res.status(400).json({
      error: 'Authorize the spending limits before checkout.',
      code: 'paid_ads_authorization_required',
    });
  }
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
    if (result.error === 'authorization_required') {
      return res.status(409).json({
        error: 'Customer spend authorization is required before activation.',
        code: result.authorizationCode || 'paid_ads_authorization_required',
        budget: result.budget,
      });
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
      message: 'Provider campaign launched within the customer-authorized spending limits.',
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
