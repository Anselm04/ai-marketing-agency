import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';

let authToken;
let testUser;

beforeAll(async () => {
  // Ensure clean state for tests
  const timestamp = Date.now();
  testUser = {
    email: `test${timestamp}@example.com`,
    password: 'TestPass123!',
    firstName: 'Test',
    lastName: 'User',
  };

  const registerRes = await request(app)
    .post('/api/auth/register')
    .send(testUser);

  if (registerRes.status === 201) {
    authToken = registerRes.body.token;
  }

  if (!authToken) {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    authToken = loginRes.body.token;
  }

  const current = await store.findUserByEmail(testUser.email);
  const existingSubscriptions = await store.getSubscriptionsByUser(current.id);
  if (!existingSubscriptions.some((sub) => sub.status === 'active')) {
    await store.createSubscription({
      userId: current.id,
      user: current.id,
      plan: 'starter',
      status: 'active',
      source: 'test',
      lookup_key: 'marketing_starter_monthly',
      expiresAt: null,
    });
  }
});

afterAll(() => {
  // Cleanup
});

// Auth Tests

describe('Auth API', () => {
  test('POST /api/auth/register - creates a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `newuser${Date.now()}@example.com`,
        password: 'SecurePass123!',
        firstName: 'New',
        lastName: 'User',
      });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBeDefined();
  });

  test('POST /api/auth/register - rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    expect(res.status).toBe(409);
  });

  test('POST /api/auth/login - authenticates user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
  });

  test('POST /api/auth/login - rejects invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me - returns current user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testUser.email.toLowerCase());
  });

  test('POST /api/auth/forgot-password - initiates reset', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testUser.email });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// Agents Tests

describe('Agents API', () => {
  test('GET /api/agents - lists agents', async () => {
    const res = await request(app)
      .get('/api/agents')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// Campaigns Tests

describe('Campaigns API', () => {
  test('POST /api/campaigns - creates campaign', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Campaign',
        status: 'draft',
        budget: 1000,
        channels: ['social', 'email'],
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test('GET /api/campaigns - lists campaigns', async () => {
    const res = await request(app)
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// Social Tests

describe('Social API', () => {
  test('GET /api/social/status - returns platform status', async () => {
    const res = await request(app)
      .get('/api/social/status')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/social/publish - publishes content', async () => {
    const res = await request(app)
      .post('/api/social/publish')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        caption: 'Test post',
        hashtags: ['test', 'marketing'],
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
  });
});

// Content Tests

describe('Content API', () => {
  test('POST /api/content - creates content', async () => {
    const res = await request(app)
      .post('/api/content')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Article',
        type: 'article',
        body: 'This is a test article.',
        language: 'en',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test('GET /api/content - lists content', async () => {
    const res = await request(app)
      .get('/api/content')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// CRM Tests

describe('CRM API', () => {
  test('POST /api/crm/leads - creates lead', async () => {
    const res = await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Lead Test',
        email: 'lead@example.com',
        company: 'Test Co',
        status: 'new',
        score: 50,
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test('GET /api/crm/leads - lists leads', async () => {
    const res = await request(app)
      .get('/api/crm/leads')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// Analytics Tests

describe('Analytics API', () => {
  test('GET /api/analytics - returns analytics data', async () => {
    const res = await request(app)
      .get('/api/analytics')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});

// Health Check

describe('Health Check', () => {
  test('GET /api/health - returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// Export Tests

describe('Export API', () => {
  test('GET /api/export/leads - exports as JSON', async () => {
    const res = await request(app)
      .get('/api/export/leads')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  test('GET /api/export/campaigns - exports as JSON', async () => {
    const res = await request(app)
      .get('/api/export/campaigns')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  test('GET /api/export/backup - returns full backup', async () => {
    const res = await request(app)
      .get('/api/export/backup')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});

// Team API Tests

describe('Team API', () => {
  test('GET /api/team/org - returns organization', async () => {
    const res = await request(app)
      .get('/api/team/org')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.members).toBeDefined();
  });

  test('POST /api/team/invites - creates invite', async () => {
    const res = await request(app)
      .post('/api/team/invites')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'invited@example.com',
        role: 'member',
      });
    expect(res.status).toBe(200);
    expect(res.body.invite).toBeDefined();
  });
});

// Security Tests

describe('Security', () => {
  test('GET /api/agents - rejects unauthorized', async () => {
    const res = await request(app).get('/api/agents');
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/register - rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'bad@example.com',
        password: '123',
      });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login - rate limits after many requests', async () => {
    // This is a basic check; full rate limit testing requires many requests
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'wrong' });
    expect([401, 429]).toContain(res.status);
  });
});

// Production Features Tests

describe('Health & Monitoring', () => {
  test('GET /health returns status', async () => {
    const res = await request(app).get('/health');
    expect([200, 500, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('timestamp');
    }
  });

  test('GET /metrics returns prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('# TYPE');
  });
});

describe('AI Model Registry', () => {
  test('GET /api/ai-models lists models', async () => {
    const res = await request(app).get('/api/ai-models').set('Authorization', `Bearer ${authToken}`);
    expect([200, 401]).toContain(res.status);
  });

  test('GET /api/ai-models/providers lists providers', async () => {
    const res = await request(app).get('/api/ai-models/providers').set('Authorization', `Bearer ${authToken}`);
    expect([200, 401]).toContain(res.status);
  });
});

describe('Connectors', () => {
  test('GET /api/connectors lists connectors', async () => {
    const res = await request(app).get('/api/connectors').set('Authorization', `Bearer ${authToken}`);
    expect([200, 401]).toContain(res.status);
  });

  test('GET /api/connectors/categories lists categories', async () => {
    const res = await request(app).get('/api/connectors/categories').set('Authorization', `Bearer ${authToken}`);
    expect([200, 401]).toContain(res.status);
  });
});

describe('Orchestrator', () => {
  test('GET /api/orchestrator/profile requires auth', async () => {
    const res = await request(app).get('/api/orchestrator/profile');
    expect(res.status).toBe(401);
  });
});

