import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  product: { type: String, required: true },
  targetAudience: { type: String, default: 'general consumers' },
  platforms: [{ type: String, enum: ['TikTok', 'Instagram', 'Google', 'YouTube', 'Facebook', 'LinkedIn', 'Twitter/X', 'Reddit', 'Pinterest'] }],
  status: { type: String, enum: ['draft', 'running', 'paused', 'completed', 'archived'], default: 'draft' },
  budget: { type: Number, default: 0 },
  spend: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  roi: { type: Number, default: 0 },
  strategy: {
    phases: [{
      name: String,
      duration: Number,
      tactics: [String],
    }],
    budgetAllocation: { type: Map, of: Number },
    kpis: [String],
    contentIdeas: [String],
    risks: [{ risk: String, mitigation: String }],
  },
  splitTests: [{
    name: String,
    variantA: { content: String, performance: Number },
    variantB: { content: String, performance: Number },
    winner: String,
    status: { type: String, enum: ['running', 'completed'], default: 'running' },
  }],
  schedule: {
    startDate: Date,
    endDate: Date,
    postsPerDay: { type: Number, default: 10 },
    bestTimes: [String],
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  tags: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

campaignSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.spend > 0) {
    this.roi = (this.revenue - this.spend) / this.spend;
  }
  next();
});

export default mongoose.model('Campaign', campaignSchema);
