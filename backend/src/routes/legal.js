import express from 'express';
import store from '../utils/store.js';
import { generateLegalDocument } from '../services/aiService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/templates', (req, res) => {
  res.json([
    { id: 'terms', name: 'Terms & Conditions', type: 'legal', status: 'ready' },
    { id: 'privacy', name: 'Privacy Policy', type: 'legal', status: 'ready' },
    { id: 'gdpr', name: 'GDPR Compliance', type: 'compliance', status: 'ready' },
    { id: 'ccpa', name: 'CCPA Notice', type: 'compliance', status: 'ready' },
    { id: 'dmca', name: 'DMCA Policy', type: 'legal', status: 'ready' },
    { id: 'cookie', name: 'Cookie Policy', type: 'compliance', status: 'ready' },
  ]);
});

router.get('/documents', (req, res) => {
  const docs = store.getLegalDocs().filter(d => d.owner === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(docs);
});

router.post('/generate', async (req, res) => {
  const { type, businessName, jurisdiction } = req.body;
  try {
    const result = await generateLegalDocument(type, businessName || 'AI Marketing Agency', jurisdiction || 'Global');
    const doc = store.createLegalDoc({
      type,
      title: `${type} - ${businessName || 'AI Marketing Agency'}`,
      businessName: businessName || 'AI Marketing Agency',
      jurisdiction: jurisdiction || 'Global',
      document: result.document,
      generatedBy: 'legal-compliance',
      fallback: result.fallback,
      owner: req.user.id,
    });
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;