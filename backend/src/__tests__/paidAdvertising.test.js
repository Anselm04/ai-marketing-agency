import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';
import {
  calculateBudgetBreakdown,
  createPaidAdBudget,
  getPaidAdBudget,
  markServiceFeePaid,
  recordProviderSpend,
} from '../services/paidAdvertisingService.js';

async function registerEntitledUser(label) {
  const email = `paid-ads-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    email,
    acceptedTerms: true,
    password: 'SecurePass123!',
  });
  const user = await store.findUserByEmail(email);
  await store.createSubscription({
    userId: user.id,
    user: user.id,
    plan: 'starter',
    status: 'active',
    source: 'test',
  });
  return { user, token: res.body.token };
}

async function configureBudgetForAdapterGate(budget) {
  return store.updateContent(budget.id, {
    enabled: true,
    providerAccountId: 'test-provider-account',
    providerAccount: { providerAccountId: 'test-provider-account', name: 'Test provider account' },
    campaignConfig: { type: 'test-validated-campaign' },
    status: 'service_fee_required',
  });
}

describe('Paid advertising budget guardrails', () => {
  test('splits an all-in budget into disclosed TrillionAI fee and external media cap', () => {
    const breakdown = calculateBudgetBreakdown(10_000, 500);
    expect(breakdown.totalBudgetCents).toBe(10_000);
    expect(breakdown.serviceFeeCents).toBe(500);
    expect(breakdown.mediaSpendCapCents).toBe(9_500);
  });

  test('each user sees only their own paid advertising budgets', async () => {
    const first = await registerEntitledUser('first');
    const second = await registerEntitledUser('second');

    const create = await request(app)
      .post('/api/paid-ads')
      .set('Authorization', `Bearer ${first.token}`)
      .send({ provider: 'meta', totalBudgetCents: 20_000, enabled: false });

    expect(create.status).toBe(201);
    expect(create.body.ownerId).toBe(first.user.id);
    expect(create.body.strictHardStop).toBe(true);

    const firstList = await request(app)
      .get('/api/paid-ads')
      .set('Authorization', `Bearer ${first.token}`);
    expect(firstList.status).toBe(200);
    expect(firstList.body.budgets.some((item) => item.id === create.body.id)).toBe(true);
    expect(firstList.body.policy.automaticBudgetIncreaseAllowed).toBe(false);
    expect(firstList.body.policy.authorizationModes).toEqual(['manual', 'bounded_auto', 'full_auto']);

    const secondList = await request(app)
      .get('/api/paid-ads')
      .set('Authorization', `Bearer ${second.token}`);
    expect(secondList.status).toBe(200);
    expect(secondList.body.budgets.some((item) => item.id === create.body.id)).toBe(false);
  });

  test('API cannot enable ads without a verified account and campaign configuration', async () => {
    const account = await registerEntitledUser('configuration-gate');
    const create = await request(app)
      .post('/api/paid-ads')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ provider: 'meta', totalBudgetCents: 20_000, enabled: true });

    expect(create.status).toBe(400);
    expect(create.body.code).toBe('paid_ads_campaign_configuration_required');
  });

  test('customer authorization requires explicit acknowledgement and password re-authentication', async () => {
    const account = await registerEntitledUser('authorization-gate');
    const budget = await createPaidAdBudget({
      userId: account.user.id,
      provider: 'meta',
      totalBudgetCents: 20_000,
      enabled: false,
    });

    const noTerms = await request(app)
      .post(`/api/paid-ads/${budget.id}/authorize`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({
        mode: 'bounded_auto',
        dailyMediaSpendCapMajor: 25,
        confirmedTotalBudgetMajor: 200,
        password: 'SecurePass123!',
      });
    expect(noTerms.status).toBe(400);
    expect(noTerms.body.code).toBe('paid_ads_authorization_terms_required');

    const wrongPassword = await request(app)
      .post(`/api/paid-ads/${budget.id}/authorize`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({
        mode: 'bounded_auto',
        dailyMediaSpendCapMajor: 25,
        confirmedTotalBudgetMajor: 200,
        acceptedAuthorizationTerms: true,
        password: 'WrongPassword123!',
      });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.code).toBe('paid_ads_reauthentication_failed');
  });

  test('authorized campaign stores caps and audit evidence without storing the password', async () => {
    const account = await registerEntitledUser('authorization-success');
    const budget = await createPaidAdBudget({
      userId: account.user.id,
      provider: 'meta',
      totalBudgetCents: 20_000,
      enabled: false,
    });

    const authorized = await request(app)
      .post(`/api/paid-ads/${budget.id}/authorize`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({
        mode: 'full_auto',
        dailyMediaSpendCapMajor: 25,
        confirmedTotalBudgetMajor: 200,
        acceptedAuthorizationTerms: true,
        password: 'SecurePass123!',
      });

    expect(authorized.status).toBe(200);
    expect(authorized.body.authorization.mode).toBe('full_auto');
    expect(authorized.body.authorization.dailyMediaSpendCapCents).toBe(2_500);
    expect(authorized.body.authorization.maxTotalBudgetCents).toBe(20_000);
    expect(authorized.body.authorization.maxMediaSpendCents).toBe(19_000);
    expect(authorized.body.authorization.termsAccepted).toBe(true);
    expect(authorized.body.authorization.password).toBeUndefined();
    expect(authorized.body.costSummary.trillionAiFeeCents).toBe(1_000);
    expect(authorized.body.costSummary.thirdPartyAdvertisingCapCents).toBe(19_000);
    expect(authorized.body.costSummary.maximumTotalExposureCents).toBe(20_000);

    const stored = await getPaidAdBudget(account.user.id, budget.id);
    expect(stored.enabled).toBe(true);
    expect(stored.authorizationHistory).toHaveLength(1);
    expect(JSON.stringify(stored.authorizationHistory)).not.toContain('SecurePass123!');
  });

  test('cannot enable a paid-ad budget through the generic toggle before customer authorization', async () => {
    const account = await registerEntitledUser('toggle-auth-gate');
    const budget = await createPaidAdBudget({
      userId: account.user.id,
      provider: 'meta',
      totalBudgetCents: 20_000,
      enabled: false,
    });

    const enabled = await request(app)
      .patch(`/api/paid-ads/${budget.id}`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({ enabled: true });

    expect(enabled.status).toBe(409);
    expect(enabled.body.code).toBe('paid_ads_authorization_required');
  });

  test('live activation stays blocked until a reviewed hard-stop provider adapter is available', async () => {
    const account = await registerEntitledUser('adapter');
    const draft = await createPaidAdBudget({
      userId: account.user.id,
      provider: 'google',
      totalBudgetCents: 50_000,
      enabled: false,
    });
    const budget = await configureBudgetForAdapterGate(draft);
    await markServiceFeePaid({
      userId: account.user.id,
      budgetId: budget.id,
      sessionId: 'cs_test_paid_ads',
    });

    const activate = await request(app)
      .post('/api/paid-ads/' + budget.id + '/activate')
      .set('Authorization', `Bearer ${account.token}`);

    expect(activate.status).toBe(409);
    expect(activate.body.code).toBe('paid_ads_authorization_required');
  });

  test('reported provider spend hard-stops exactly at the external media cap', async () => {
    const account = await registerEntitledUser('hardstop');
    const budget = await createPaidAdBudget({
      userId: account.user.id,
      provider: 'meta',
      totalBudgetCents: 10_000,
      enabled: false,
    });

    const stopped = await recordProviderSpend({
      userId: account.user.id,
      budgetId: budget.id,
      spendCents: budget.mediaSpendCapCents,
      providerCampaignId: 'campaign_test_1',
    });

    expect(stopped.status).toBe('hard_stopped');
    expect(stopped.remainingMediaBudgetCents).toBe(0);
    expect(stopped.hardStopReason).toBe('spend_limit_reached');

    const stored = await getPaidAdBudget(account.user.id, budget.id);
    expect(stored.pausedAt).toBeTruthy();
  });

  test('user can disable paid advertising immediately', async () => {
    const account = await registerEntitledUser('toggle');
    const draft = await createPaidAdBudget({
      userId: account.user.id,
      provider: 'meta',
      totalBudgetCents: 15_000,
      enabled: false,
    });
    await store.updateContent(draft.id, { enabled: true, status: 'ready' });

    const off = await request(app)
      .patch('/api/paid-ads/' + draft.id)
      .set('Authorization', `Bearer ${account.token}`)
      .send({ enabled: false });

    expect(off.status).toBe(200);
    expect(off.body.enabled).toBe(false);
    expect(off.body.status).toBe('disabled');
    expect(off.body.hardStopReason).toBe('user_disabled');
  });
});
