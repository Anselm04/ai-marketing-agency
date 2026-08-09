import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema({
  agentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  category: { type: String, enum: ['strategy', 'creative', 'optimization', 'compliance', 'operations', 'meta'], default: 'operations' },
  status: { type: String, enum: ['active', 'idle', 'error', 'maintenance'], default: 'idle' },
  lastActive: { type: Date, default: Date.now },
  config: {
    model: { type: String, default: 'gpt-4o-mini' },
    temperature: { type: Number, default: 0.7 },
    maxTokens: { type: Number, default: 800 },
    autoExecute: { type: Boolean, default: false },
    schedule: String,
  },
  metrics: {
    tasksCompleted: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 },
    successRate: { type: Number, default: 1.0 },
  },
  dependencies: [{ type: String }],
  permissions: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

agentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Agent', agentSchema);
