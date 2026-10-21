import express from 'express';
import request from 'supertest';
import { describe, expect, test } from '@jest/globals';
import teamRoutes from '../routes/team.js';

describe('team collaboration availability', () => {
  test('fails closed until shared-workspace tenancy is implemented', async () => {
    const app = express();
    app.use(express.json());
    app.use('/team', teamRoutes);

    const response = await request(app).get('/team/org');

    expect(response.status).toBe(503);
    expect(response.body).toEqual(expect.objectContaining({
      code: 'team_collaboration_unavailable',
    }));
  });
});
