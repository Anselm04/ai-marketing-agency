import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';
import { signEcosystemPayload } from '../services/ecosystemSignature.js';
import { canonicalOwnerEmail } from '../utils/owner.js';

const SECRET = 'owner-portfolio-test-secret';

function signedPost(body) {
  process.env.TRILLION_ECOSYSTEM_SHARED_SECRET = SECRET;
  const timestamp = String(Date.now());
  const signature = signEcosystemPayload(SECRET, timestamp, JSON.stringify(body));
  return request(app)
    .post('/api/integrations/appforge/campaign')
    .set('X-Trillion-Source', 'appforge')
    .set('X-Trillion-Timestamp', timestamp)
    .set('X-Trillion-Signature', signature)
    .send(body);
}

describe('Owner-only AppForge portfolio intake', () => {
  beforeAll(async () => {
    const ownerEmail = canonicalOwnerEmail();
    const existing = await store.findUserByEmail(ownerEmail);
    if (!existing) {
      await store.createUser({
        email: ownerEmail,
        password: 'OwnerPortfolioTest123!',
        role: 'user',
        profile: { firstName: 'Owner', lastName: 'Portfolio' },
      });
    }
  });

  test('ignores another AppForge users product even when generate is requested', async () => {
    const sourceProjectId = 800000000 + Math.floor(Math.random() * 1000000);
    const body = {
      source: 'appforge',
      sourceProjectId,
      sourceProjectCreatedAt: new Date().toISOString(),
      sourceUserEmail: 'another-appforge-user@example.com',
      sourceUserName: 'Other User',
      productName: 'Other Users Product',
      description: 'This product must never enter the owner portfolio or automatic advertising.',
      productUrl: 'https://example.com/other-product',
      mode: 'generate',
    };

    const res = await signedPost(body);

    expect(res.status).toBe(202);
    expect(res.body.ownerPortfolioAdded).toBe(false);
    expect(res.body.automatedMarketing).toBe(false);
    expect(res.body.code).toBe('non_owner_appforge_product_ignored');

    const owner = await store.findUserByEmail(canonicalOwnerEmail());
    const ownerContent = await store.getContentByOwner(owner.id);
    const ownerCampaigns = await store.getCampaignsByOwner(owner.id);

    expect(ownerContent.some((item) => item.sourceProjectId === sourceProjectId)).toBe(false);
    expect(ownerCampaigns.some((item) => item.sourceProjectId === sourceProjectId)).toBe(false);
  });

  test('adds only the canonical owners AppForge product to the personal portfolio', async () => {
    const sourceProjectId = 810000000 + Math.floor(Math.random() * 1000000);
    const body = {
      source: 'appforge',
      sourceProjectId,
      sourceProjectCreatedAt: new Date().toISOString(),
      sourceUserEmail: canonicalOwnerEmail(),
      sourceUserName: 'Owner',
      productName: 'Owner Portfolio Product',
      description: 'A verified owner product ready to sit beside the owners other products.',
      techStack: 'React, Node',
      productUrl: 'https://example.com/owner-product',
      mode: 'draft',
    };

    const res = await signedPost(body);

    expect(res.status).toBe(201);
    expect(res.body.ownerPortfolioAdded).toBe(true);
    expect(res.body.automatedMarketing).toBe(false);
    expect(res.body.portfolioProduct).toEqual(expect.objectContaining({
      source: 'appforge',
      sourceProjectId,
      ownerOnly: true,
      autoMarketingEligible: true,
      productName: 'Owner Portfolio Product',
    }));
    expect(res.body.campaign).toEqual(expect.objectContaining({
      source: 'appforge',
      sourceProjectId,
      ownerPortfolioProduct: true,
      status: 'draft',
    }));
  });
});
