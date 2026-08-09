import mongoose from 'mongoose';

const legalDocumentSchema = new mongoose.Schema({
  type: { type: String, enum: ['terms', 'privacy', 'gdpr', 'ccpa', 'dmca', 'cookie', 'contract', 'dispute'], required: true },
  title: { type: String, required: true },
  businessName: { type: String, required: true },
  jurisdiction: { type: String, default: 'Global' },
  document: { type: String, required: true },
  generatedBy: { type: String, default: 'legal-compliance' },
  reviewStatus: { type: String, enum: ['draft', 'reviewed', 'approved', 'rejected'], default: 'draft' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  campaigns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }],
  version: { type: Number, default: 1 },
  previousVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'LegalDocument' },
  fallback: { type: Boolean, default: false },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

legalDocumentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('LegalDocument', legalDocumentSchema);
