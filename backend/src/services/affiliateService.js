import store from '../utils/store.js';

class AffiliateService {
  generateCode(userId) {
    const prefix = 'AMA';
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${userId.toString().slice(-4)}-${suffix}`;
  }

  async assignCode(userId) {
    const subscription = (await store.getSubscriptions()).find(s => s.user === userId);
    if (!subscription) return null;

    if (!subscription.affiliateCode) {
      subscription.affiliateCode = this.generateCode(userId);
      await store.updateSubscription(subscription.id, { affiliateCode: subscription.affiliateCode });
    }

    return { code: subscription.affiliateCode, link: `${process.env.APP_URL || 'http://localhost:3000'}/register?ref=${subscription.affiliateCode}` };
  }

  async trackReferral(code, referredUserId) {
    const subscription = (await store.getSubscriptions()).find(s => s.affiliateCode === code);
    if (!subscription) return { error: 'Invalid referral code' };

    const referrals = subscription.referrals || [];
    referrals.push({
      code,
      referredUser: referredUserId,
      commission: 0,
      status: 'pending',
    });
    await store.updateSubscription(subscription.id, { referrals });

    return { success: true, referrer: subscription.user, commissionPending: true };
  }

  async payoutCommission(subscriptionId, referredUserId) {
    const subscription = (await store.getSubscriptions()).find(s => s.id === subscriptionId);
    if (!subscription) return null;

    const referrals = subscription.referrals || [];
    const referral = referrals.find(r => r.referredUser === referredUserId);
    if (!referral) return null;

    const commission = 20;
    referral.commission = commission;
    referral.status = 'paid';
    await store.updateSubscription(subscription.id, { referrals });

    return { success: true, commission };
  }

  async getStats(userId) {
    const subscription = (await store.getSubscriptions()).find(s => s.user === userId);
    if (!subscription || !subscription.affiliateCode) return null;

    const referrals = subscription.referrals || [];
    const paid = referrals.filter(r => r.status === 'paid');
    const pending = referrals.filter(r => r.status === 'pending');
    const totalCommission = paid.reduce((sum, r) => sum + (r.commission || 0), 0);

    return {
      code: subscription.affiliateCode,
      totalReferrals: referrals.length,
      paidReferrals: paid.length,
      pendingReferrals: pending.length,
      totalCommission,
      referrals,
    };
  }
}

export default new AffiliateService();
