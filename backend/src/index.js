import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import agentRoutes from './routes/agents.js';
import campaignRoutes from './routes/campaigns.js';
import analyticsRoutes from './routes/analytics.js';
import legalRoutes from './routes/legal.js';
import authRoutes from './routes/auth.js';
import socialRoutes from './routes/social.js';
import contentRoutes from './routes/content.js';
import videoRoutes from './routes/video.js';
import billingRoutes from './routes/billing.js';
import crmRoutes from './routes/crm.js';
import affiliateRoutes from './routes/affiliate.js';
import schedulerRoutes from './routes/scheduler.js';
import trendsRoutes from './routes/trends.js';
import adminRoutes from './routes/admin.js';
import settingsRoutes from './routes/settings.js';
import translationRoutes from './routes/translation.js';
import exportRoutes from './routes/export.js';
import teamRoutes from './routes/team.js';
import uploadRoutes from './routes/uploads.js';
import searchRoutes from './routes/search.js';
import { serveUploads } from './routes/uploads.js';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { sanitizeBody } from './middleware/sanitize.js';
import { validateEnv } from './middleware/envCheck.js';
import { auditLog } from './middleware/auditLog.js';
import { authenticate } from './middleware/auth.js';
import schedulerService from './services/schedulerService.js';
import store from './utils/store.js';

dotenv.config();
validateEnv();

store.connectDB();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS whitelist
const whitelist = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173').split(',');
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

store.seedAgents([
  { agentId: 'chief-strategy', name: 'Chief Strategy Agent', role: 'Oversees all operations and revenue generation priorities', category: 'strategy', status: 'active', lastActive: new Date().toISOString() },
  { agentId: 'social-media', name: 'Social Media Agent', role: 'Creates, schedules, posts, and auto-responds on social platforms', category: 'creative', status: 'active', lastActive: new Date().toISOString() },
  { agentId: 'content', name: 'Content Agent', role: 'Writes articles, ad copy, SEO text, video scripts', category: 'creative', status: 'active', lastActive: new Date().toISOString() },
  { agentId: 'seo-aeo', name: 'SEO/AEO Agent', role: 'Manages Google rank, app store AEO', category: 'optimization', status: 'idle', lastActive: new Date().toISOString() },
  { agentId: 'video', name: 'Video Agent', role: 'Generates engaging video ads, animations, tutorials', category: 'creative', status: 'active', lastActive: new Date().toISOString() },
  { agentId: 'legal-compliance', name: 'Legal Compliance Agent', role: 'Reviews all marketing for platform, privacy, ad law compliance', category: 'compliance', status: 'active', lastActive: new Date().toISOString() },
  { agentId: 'customer-service', name: 'Customer Service Agent', role: 'Handles inquiries, feedback, FAQs, issues', category: 'operations', status: 'idle', lastActive: new Date().toISOString() },
  { agentId: 'ai-trainer', name: 'AI Trainer Agent', role: 'Keeps all agents learning and adapting from user interactions', category: 'meta', status: 'active', lastActive: new Date().toISOString() },
  { agentId: 'performance-optimizer', name: 'Performance Optimizer', role: 'A/B testing, split testing, and data-driven campaign improvements', category: 'optimization', status: 'idle', lastActive: new Date().toISOString() },
  { agentId: 'market-research', name: 'Market Research Agent', role: 'Constantly scans trends and market data for new growth opportunities', category: 'strategy', status: 'active', lastActive: new Date().toISOString() },
  { agentId: 'automation-coordinator', name: 'Automation Coordinator', role: 'Ensures all agents act in sync, without conflicts or drift', category: 'operations', status: 'active', lastActive: new Date().toISOString() },
  { agentId: 'agent-oversight', name: 'Agent Oversight AI', role: 'Monitors all agents for focus, teamwork, integrity', category: 'meta', status: 'active', lastActive: new Date().toISOString() },
  { agentId: 'harmony-director', name: 'Harmony Director AI', role: 'Ensures maximum synergy and no wasted effort between agents', category: 'meta', status: 'active', lastActive: new Date().toISOString() },
]);

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeBody);
app.use(auditLog);
app.use(rateLimit);

app.use('/api/auth', authRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), db: 'json-store' });
});
app.use(authenticate);
app.use('/api/agents', agentRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/affiliate', affiliateRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/translation', translationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/uploads', authenticate, uploadRoutes);
app.use('/api/search', authenticate, searchRoutes);

serveUploads(app);

app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    schedulerService.start();
  });
} else {
  // In test mode, export app without starting server
}

export default app;