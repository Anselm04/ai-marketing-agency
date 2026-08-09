import express from 'express';
import { generateLegalDocument } from '../services/openaiService.js';

const router = express.Router();

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

router.post('/generate', async (req, res) => {
  const { type, businessName, jurisdiction } = req.body;

  try {
    const result = await generateLegalDocument(type, businessName || 'AI Marketing Agency', jurisdiction || 'Global');
    res.json({
      success: true,
      type,
      document: result.document,
      fallback: result.fallback,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;