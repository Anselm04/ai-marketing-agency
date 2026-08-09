import express from 'express';

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

router.post('/generate', (req, res) => {
  const { type, businessName, jurisdiction } = req.body;
  res.json({
    success: true,
    type,
    document: `Generated ${type} for ${businessName} (${jurisdiction}). This is a placeholder for AI-generated legal content.`,
    generatedAt: new Date().toISOString()
  });
});

export default router;