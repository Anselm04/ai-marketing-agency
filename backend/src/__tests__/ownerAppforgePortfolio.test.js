import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';
import { signEcosystemPayload } from '../services/ecosystemSignature.js';
import { canonicalOwnerEmail } from '../utils/owner.js';

const BRIDGE_SECRET = 'portfolio-test-bridge-secret';

function signedPost(body) {
  process.env.TRILLION_ECOSYSTEM_SHARED_SECRET = BRIDGE_SECRET;
  const timestamp = String(Date.now());
  const signature = signEcosystemPayload(BRIDGE_SECRET, timestamp, JSON.stringify(body));
  return request(app)
    .post('/api/integrations/appforge/campaign')
    .set('X-Trillion-Source', 'appforge')
    .set('X-Trillion-Timestamp', timestamp)
    .set('X-Trillion-Signature', signature)
    .send(body);
}

describe('Per-user AppForge Marketing portfolios', () => {
  let locked;
  let lockedToken;
  let paid;
  let paidToken;
  let granted;
  let owner;

  beforeAll(async () => {
    const stamp = Date.now();

    const lockedReg = await request(app).post('/api/auth/register').send({
      email: `portfolio-locked-${stamp}@example.com`,
      password: 'SecurePass123!',
    });
    lockedToken = lockedReg.body.token;
    locked = await store.findUserByEmail(lockedReg.body.user.email);

    const paidReg = await request(app).post('/api/auth/register').send({
      email: `portfolio-paid-${stamp}@example.com`,
      password: 'SecurePass123!',
    });
    paidToken = paidReg.body.token;
    paid = await store.findUserByEmail(paidReg.body.user.email);

    const grantedReg = await request(app).post('/api/auth/register').send({
      email: `portfolio-granted-${stamp}@example.com`,
      password: 'SecurePass123!',
    });
    granted = await store.findUserByEmail(grantedReg.body.user.email);

    owner = await store.findUserByEmail(canonicalOwnerEmail());
    if (!owner) {
      owner = await store.createUser({
        email: canonicalOwnerEmail(),
        password: 'OwnerPortfolioTest123!',
      });
    }

    await store.createSubscription({
      userId: paid.id,
      user: paid.id,
      plan: 'growth',
      status: 'active',
      source: 'stripe',
    });

    await store.createSubscription({
      userId: granted.id,
      user: granted.id,
      plan: 'agency',
      status: 'active',
      source: 'god-code',
      lifetimeAccess: true,
    });
  });

  test('unpaid user keeps their product privately but marketing is locked', async () => {
    const sourceProjectId = 820000001;
    const res = await signedPost({
      source: 'appforge',
      sourceProjectId,
      sourceUserEmail: locked.email,
      productName: 'Locked Product',
      description: 'Private to this account.',
      mode: 'generate',
    });

    expect(res.status).toBe(402);
    expect(res.body.portfolioAdded).toBe(true);
    expect(res.body.billingRequired).toBe(true);
    expect(res.body.automatedMarketing).toBe(false);
    expect(res.body.portfolioProduct.owner).toBe(locked.id);

    const lockedCampaigns = await store.getCampaignsByOwner(locked.id);
    expect(lockedCampaigns.some((item) => item.sourceProjectId === sourceProjectId)).toBe(false);

    const ownerCampaigns = await store.getCampaignsByOwner(owner.id);
    expect(ownerCampaigns.some((item) => item.sourceProjectId === sourceProjectId)).toBe(false);
  });

  test('paid user can market only inside their own account', async () => {
    const sourceProjectId = 830000001;
    const res = await signedPost({
      source: 'appforge',
      sourceProjectId,
      sourceUserEmail: paid.email,
      productName: 'Paid Product',
      description: 'Private paid-user product.',
      mode: 'generate',
    });

    expect(res.status).toBe(201);
    expect(res.body.billingRequired).toBe(false);
    expect(res.body.portfolioProduct.owner).toBe(paid.id);
    expect(res.body.campaign.owner).toBe(paid.id);

    const ownPortfolio = await request(app)
      .get('/api/products/portfolio')
      .set('Authorization', `Bearer ${paidToken}`);
    expect(ownPortfolio.body.some((item) => item.sourceProjectId === sourceProjectId)).toBe(true);

    const otherPortfolio = await request(app)
      .get('/api/products/portfolio')
      .set('Authorization', `Bearer ${lockedToken}`);
    expect(otherPortfolio.body.some((item) => item.sourceProjectId === sourceProjectId)).toBe(false);
  });

  test('owner-issued plan access unlocks AppForge marketing for that user', async () => {
    const sourceProjectId = 840000001;
    const res = await signedPost({
      source: 'appforge',
      sourceProjectId,
      sourceUserEmail: granted.email,
      productName: 'Granted Product',
      description: 'Private granted-access product.',
      mode: 'draft',
    });

    expect(res.status).toBe(201);
    expect(res.body.billingRequired).toBe(false);
    expect(res.body.portfolioProduct.owner).toBe(granted.id);
    expect(res.body.campaign.owner).toBe(granted.id);
  });

  test('manual product marketing is also locked for unpaid users', async () => {
    const res = await request(app)
      .post('/api/products/marketing')
      .set('Authorization', `Bearer ${lockedToken}`)
      .send({ productName: 'Manual Product', description: 'Locked before generation.' });

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('marketing_access_required');
  });
});
