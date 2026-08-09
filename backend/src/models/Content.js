import mongoose from 'mongoose';

const contentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['article', 'ad_copy', 'script', 'caption', 'email', 'landing_page', 'seo_text', 'legal_doc'], required: true },
  body: { type: String, required: true },
  platform: { type: String, enum: ['TikTok', 'Instagram', 'Google', 'YouTube', 'Facebook', 'LinkedIn', 'Twitter/X', 'Reddit', 'Pinterest', 'blog', 'email'], default: 'blog' },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  agentId: { type: String, default: 'content' },
  status: { type: String, enum: ['draft', 'review', 'approved', 'published', 'archived'], default: 'draft' },
  translations: [{
    language: String,
    body: String,
    autoTranslated: { type: Boolean, default: true },
  }],
  seo: {
    keywords: [String],
    metaTitle: String,
    metaDescription: String,
    slug: String,
  },
  performance: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 },
  },
  tags: [String],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledAt: Date,
  publishedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

contentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Content', contentSchema);
