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
      .send({ provider: 'meta', totalBudgetCents: 20_000, enabled: true });

    expect(create.status).toBe(201);
    expect(create.body.ownerId).toBe(first.user.id);
    expect(create.body.strictHardStop).toBe(true);

    const firstList = await request(app)
      .get('/api/paid-ads')
      .set('Authorization', `Bearer ${first.token}`);
    expect(firstList.status).toBe(200);
    expect(firstList.body.budgets.some((item) => item.id === create.body.id)).toBe(true);

    const secondList = await request(app)
      .get('/api/paid-ads')
      .set('Authorization', `Bearer ${second.token}`);
    expect(secondList.status).toBe(200);
    expect(secondList.body.budgets.some((item) => item.id === create.body.id)).toBe(false);
  });

  test('live activation stays blocked until a reviewed hard-stop provider adapter is available', async () => {
    const account = await registerEntitledUser('adapter');
    const budget = await createPaidAdBudget({
      userId: account.user.id,
      provider: 'google',
      totalBudgetCents: 50_000,
      enabled: true,
    });
    await markServiceFeePaid({
      userId: account.user.id,
      budgetId: budget.id,
      sessionId: 'cs_test_paid_ads',
    });

    const activate = await request(app)
      .post('/api/paid-ads/' + budget.id + '/activate')
      .set('Authorization', `Bearer ${account.token}`);

    expect(activate.status).toBe(409);
    expect(activate.body.code).toBe('paid_ads_provider_adapter_required');
  });

  test('reported provider spend hard-stops exactly at the external media cap', async () => {
    const account = await registerEntitledUser('hardstop');
    const budget = await createPaidAdBudget({
      userId: account.user.id,
      provider: 'meta',
      totalBudgetCents: 10_000,
      enabled: true,
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
    const create = await request(app)
      .post('/api/paid-ads')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ provider: 'meta', totalBudgetCents: 15_000, enabled: true });

    const off = await request(app)
      .patch('/api/paid-ads/' + create.body.id)
      .set('Authorization', `Bearer ${account.token}`)
      .send({ enabled: false });

    expect(off.status).toBe(200);
    expect(off.body.enabled).toBe(false);
    expect(off.body.status).toBe('disabled');
    expect(off.body.hardStopReason).toBe('user_disabled');
  });
});
