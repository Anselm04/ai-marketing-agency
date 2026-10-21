import { describe, expect, test } from '@jest/globals';
import { CATALOG } from '../config/stripeCatalog.js';

describe('commercial catalog truthfulness', () => {
  test('does not advertise unimplemented plan entitlements', () => {
    for (const plan of CATALOG.plans) {
      expect(plan.features).not.toHaveProperty('languages');
      expect(plan.features).not.toHaveProperty('apiAccess');
      expect(plan.features).not.toHaveProperty('whiteLabel');
      expect(plan.features).not.toHaveProperty('teamSeats');
    }
  });
});
