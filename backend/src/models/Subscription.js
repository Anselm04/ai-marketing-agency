import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['starter', 'growth', 'pro', 'enterprise'], default: 'starter' },
  billingInterval: { type: String, enum: ['weekly', 'monthly', 'yearly'], default: 'monthly' },
  price: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  status: { type: String, enum: ['active', 'paused', 'cancelled', 'past_due', 'trialing'], default: 'trialing' },
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  stripePriceId: String,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  features: {
    agents: { type: Number, default: 3 },
    campaigns: { type: Number, default: 2 },
    postsPerDay: { type: Number, default: 10 },
    languages: { type: Number, default: 5 },
    teamSeats: { type: Number, default: 1 },
    apiAccess: { type: Boolean, default: false },
    whiteLabel: { type: Boolean, default: false },
  },
  usage: {
    tokensUsed: { type: Number, default: 0 },
    tokensLimit: { type: Number, default: 100000 },
    postsPublished: { type: Number, default: 0 },
    postsLimit: { type: Number, default: 300 },
  },
  referrals: [{
    code: String,
    referredUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commission: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  }],
  affiliateCode: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

subscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Subscription', subscriptionSchema);
