import store from '../utils/store.js';
import { hashGodCode } from '../utils/owner.js';
import { findItem } from '../config/stripeCatalog.js';
import { grantUserCredits } from './billingPersistence.js';
import { logger } from '../utils/logger.js';

const REDEEM_FAIL = 'Unable to redeem that code.';

function resolveGrantItem(found) {
  const sku = found.sku || found.grantType;
  if (sku === 'lifetime') return findItem({ id: 'enterprise' });
  if (sku === 'limited') return findItem({ id: 'growth' });
  return findItem({ id: sku }) || findItem({ lookup_key: found.lookup_key });
}

function existingGodCodeSubscription(subscriptions = []) {
  return subscriptions.find((entry) => entry.source === 'god-code') || null;
}

async function restoreConsumedGodCode(found, consumed, userId) {
  if (!consumed?.id || !found?.hash) return false;
  if (consumed.redeemedByUserId !== userId && consumed.usedByUserId !== userId) return false;
  const restored = await store.updateGodCode(consumed.id, {
    encryptedCode: found.encryptedCode || null,
    redeemedAt: null,
    redeemedByUserId: null,
    isUsed: false,
    usedAt: null,
    usedByUserId: null,
  });
  return Boolean(restored);
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

  const redeemedAt = new Date();
  const now = redeemedAt.toISOString();
  const accessMode = found.accessMode === 'timed' ? 'timed' : 'lifetime';
  const durationDays = accessMode === 'timed' ? Number(found.durationDays) : null;
  if (accessMode === 'timed' && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365)) {
    throw new Error(REDEEM_FAIL);
  }
  const expiresAt = accessMode === 'timed'
    ? new Date(redeemedAt.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const consumed = await store.consumeGodCode(hash, userId, now);
  if (!consumed) throw new Error(REDEEM_FAIL);

  const kind = item.interval ? 'plan' : 'credits';
  const subscriptions = typeof store.getSubscriptionsByUser === 'function'
    ? await store.getSubscriptionsByUser(userId)
    : (await store.getSubscriptions()).filter((entry) => entry.user === userId || entry.userId === userId);
  let subscription = existingGodCodeSubscription(subscriptions);
  const creditAdd = kind === 'credits' ? (item.credits || 0) : 0;
  let nextCredits = Number((await store.findUserById(userId))?.profile?.credits || 0);

  try {
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
        accessMode,
        lifetimeAccess: accessMode === 'lifetime',
        durationDays,
        expiresAt,
      };
      if (subscription) subscription = await store.updateSubscription(subscription.id, grant);
      else subscription = await store.createSubscription(grant);
      if (!subscription) throw new Error('God-code plan grant was not persisted.');
    } else if (creditAdd > 0) {
      const creditGrant = await grantUserCredits(userId, creditAdd);
      if (!creditGrant) throw new Error('God-code credit grant was not persisted.');
      nextCredits = creditGrant.credits;
    }
  } catch (error) {
    try {
      await restoreConsumedGodCode(found, consumed, userId);
    } catch (restoreError) {
      logger.error('Unable to restore consumed god code after grant failure', {
        codeId: consumed.id,
        userId,
        error: restoreError.message,
      });
    }
    logger.error('God-code redemption failed while granting access', {
      codeId: consumed.id,
      userId,
      kind,
      error: error.message,
    });
    throw new Error(REDEEM_FAIL);
  }

  try {
    const user = await store.findUserById(userId);
    await store.updateUser(userId, {
      profile: {
        ...(user?.profile || {}),
        godGrant: item.id,
        godRedeemedAt: now,
        ...(kind === 'credits' ? { credits: nextCredits } : {}),
      },
    });
  } catch (error) {
    logger.warn('God-code grant succeeded but profile metadata update failed', {
      codeId: consumed.id,
      userId,
      error: error.message,
    });
  }

  return {
    success: true,
    sku: item.id,
    grantType: item.id,
    kind,
    name: item.name,
    credits: nextCredits,
    addedCredits: creditAdd,
    accessMode,
    durationDays,
    expiresAt,
    subscription: subscription || { status: 'none' },
  };
}

export async function normalizeSubscriptionAccess(subscription) {
  if (!subscription || subscription.status === 'none') return subscription;
  if (
    subscription.source === 'god-code'
    && subscription.expiresAt
    && new Date(subscription.expiresAt).getTime() <= Date.now()
    && subscription.status === 'active'
  ) {
    return store.updateSubscription(subscription.id, {
      status: 'expired',
      expiredAt: new Date().toISOString(),
    });
  }
  return subscription;
}

export { REDEEM_FAIL, existingGodCodeSubscription, restoreConsumedGodCode };
