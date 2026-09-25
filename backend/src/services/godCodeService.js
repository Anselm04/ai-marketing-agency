import store from '../utils/store.js';
import { hashGodCode } from '../utils/owner.js';
import { findItem } from '../config/stripeCatalog.js';

const REDEEM_FAIL = 'Unable to redeem that code.';

function resolveGrantItem(found) {
  const sku = found.sku || found.grantType;
  if (sku === 'lifetime') return findItem({ id: 'enterprise' });
  if (sku === 'limited') return findItem({ id: 'growth' });
  return findItem({ id: sku }) || findItem({ lookup_key: found.lookup_key });
}

export async function redeemGodCodeForUser(userId, rawCode) {
  const raw = String(rawCode || '').trim();
  if (!raw) throw new Error(REDEEM_FAIL);

  let hash;
  try {
    hash = hashGodCode(raw);
  } catch {
    throw new Error(REDEEM_FAIL);
  }

  const found = await store.findGodCodeByHash(hash);
  if (!found || found.redeemedAt || found.isUsed || found.redeemedByUserId || found.usedByUserId) {
    throw new Error(REDEEM_FAIL);
  }

  const item = resolveGrantItem(found);
  if (!item) throw new Error(REDEEM_FAIL);

  const now = new Date().toISOString();
  const updated = await store.updateGodCode(found.id, {
    encryptedCode: null,
    redeemedAt: now,
    redeemedByUserId: userId,
    isUsed: true,
    usedAt: now,
    usedByUserId: userId,
  });
  if (!updated) throw new Error(REDEEM_FAIL);

  const kind = item.interval ? 'plan' : 'credits';
  const user = await store.findUserById(userId);
  let subscription = (await store.getSubscriptions()).find(
    (entry) => entry.user === userId || entry.userId === userId,
  );
  const creditAdd = kind === 'credits' ? (item.credits || 0) : 0;
  const nextCredits = (user?.credits || 0) + creditAdd;

  if (kind === 'plan') {
    const grant = {
      userId,
      user: userId,
      plan: item.id,
      status: 'active',
      source: 'god-code',
      godGrant: item.id,
      lookup_key: item.lookup_key,
      unlimited: item.id === 'enterprise',
      expiresAt: null,
    };
    if (subscription) subscription = await store.updateSubscription(subscription.id, grant);
    else subscription = await store.createSubscription(grant);
  }

  await store.updateUser(userId, {
    godGrant: item.id,
    godRedeemedAt: now,
    credits: nextCredits,
    plan: kind === 'plan' ? item.id : user?.plan,
  });

  return {
    success: true,
    sku: item.id,
    grantType: item.id,
    kind,
    name: item.name,
    credits: nextCredits,
    addedCredits: creditAdd,
    subscription: subscription || { status: 'none' },
  };
}

export { REDEEM_FAIL };
