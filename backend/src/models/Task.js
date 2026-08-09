import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  taskId: { type: String, required: true, unique: true },
  agentId: { type: String, required: true, index: true },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  task: { type: String, required: true },
  type: { type: String, enum: ['strategy', 'content', 'publish', 'analyze', 'optimize', 'legal', 'research', 'customer_service'], default: 'content' },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'cancelled'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  context: { type: mongoose.Schema.Types.Mixed, default: {} },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  error: String,
  tokensUsed: { type: Number, default: 0 },
  durationMs: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date,
});

taskSchema.index({ createdAt: -1 });
taskSchema.index({ status: 1, agentId: 1 });

export default mongoose.model('Task', taskSchema);
