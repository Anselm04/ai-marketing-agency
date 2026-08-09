import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  firstName: String,
  lastName: String,
  company: String,
  phone: String,
  source: { type: String, enum: ['social', 'ads', 'organic', 'referral', 'affiliate', 'email', 'event'], default: 'organic' },
  platform: { type: String, enum: ['TikTok', 'Instagram', 'Google', 'YouTube', 'Facebook', 'LinkedIn', 'Twitter/X', 'Reddit', 'Pinterest', 'blog', 'email', 'direct'], default: 'direct' },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  status: { type: String, enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'nurture'], default: 'new' },
  score: { type: Number, default: 0 },
  tags: [String],
  notes: String,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  interactions: [{
    type: { type: String, enum: ['email', 'call', 'meeting', 'social_dm', 'note'], default: 'note' },
    content: String,
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  lastContactedAt: Date,
  convertedAt: Date,
  value: { type: Number, default: 0 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

leadSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

leadSchema.index({ email: 1, owner: 1 }, { unique: true });

export default mongoose.model('Lead', leadSchema);
