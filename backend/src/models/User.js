import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'editor', 'viewer'], default: 'manager' },
  profile: {
    firstName: String,
    lastName: String,
    company: String,
    timezone: { type: String, default: 'UTC' },
  },
  team: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'manager', 'editor', 'viewer'], default: 'editor' },
  }],
  subscriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' }],
  apiKeys: [{
    name: String,
    key: String,
    lastUsed: Date,
    createdAt: { type: Date, default: Date.now },
  }],
  settings: {
    notifications: { type: Boolean, default: true },
    twoFactorEnabled: { type: Boolean, default: false },
    language: { type: String, default: 'en' },
  },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('User', userSchema);
