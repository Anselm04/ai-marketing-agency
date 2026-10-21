import { describe, expect, test } from '@jest/globals';
import { CATALOG, isCatalogItemPurchasable, publicCatalog } from '../config/stripeCatalog.js';

describe('credit checkout policy', () => {
  test('subscription plans remain purchasable', () => {
    expect(CATALOG.plans.every((plan) => isCatalogItemPurchasable(plan))).toBe(true);
  });

  test('credit packs are not purchasable until a burn model exists', () => {
    expect(CATALOG.credits.every((pack) => !isCatalogItemPurchasable(pack))).toBe(true);
  });

  test('public catalog does not advertise unavailable credit packs', () => {
    expect(publicCatalog().credits).toEqual([]);
  });
});
