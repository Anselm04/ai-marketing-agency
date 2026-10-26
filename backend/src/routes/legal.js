import express from 'express';
import store from '../utils/store.js';
import { generateLegalDocument } from '../services/openaiService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const LEGAL_TYPES = new Map([
  ['terms', { name: 'Terms & Conditions', type: 'legal' }],
  ['privacy', { name: 'Privacy Policy', type: 'legal' }],
  ['gdpr', { name: 'GDPR Compliance', type: 'compliance' }],
  ['ccpa', { name: 'CCPA Notice', type: 'compliance' }],
  ['dmca', { name: 'DMCA Policy', type: 'legal' }],
  ['cookie', { name: 'Cookie Policy', type: 'compliance' }],
]);

function legalGenerationError(message, code = 'legal_generation_unavailable', status = 503) {
  return Object.assign(new Error(message), { code, status, statusCode: status });
}

function requireRealLegalDraft(result) {
  const document = String(result?.document || '').trim();
  if (!result || result.fallback === true || !document) {
    throw legalGenerationError(
      'The AI provider did not generate a complete legal document. Nothing was saved.',
    );
  }
  return document;
}

router.get('/templates', (_req, res) => {
  res.json([...LEGAL_TYPES.entries()].map(([id, item]) => ({
    id,
    name: item.name,
    type: item.type,
    status: 'available_for_generation',
    requiresLegalReview: true,
    productionReadyWithoutReview: false,
  })));
});

router.get('/documents', async (req, res, next) => {
  try {
    const docs = (await store.getLegalDocs())
      .filter((doc) => doc.owner === req.user.id || doc.ownerId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(docs);
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req, res, next) => {
  const type = String(req.body?.type || '').trim().toLowerCase();
  const businessName = String(req.body?.businessName || '').trim();
  const jurisdiction = String(req.body?.jurisdiction || '').trim();

  if (!LEGAL_TYPES.has(type)) {
    return res.status(400).json({
      error: 'Select a supported legal document type.',
      code: 'legal_document_type_invalid',
      supportedTypes: [...LEGAL_TYPES.keys()],
    });
  }
  if (!businessName) {
    return res.status(400).json({ error: 'Business name is required.', code: 'legal_business_name_required' });
  }
  if (!jurisdiction) {
    return res.status(400).json({ error: 'Jurisdiction is required.', code: 'legal_jurisdiction_required' });
  }

  try {
    const result = await generateLegalDocument(type, businessName, jurisdiction);
    const document = requireRealLegalDraft(result);

    const doc = await store.createLegalDoc({
      type,
      title: `${LEGAL_TYPES.get(type).name} - ${businessName}`,
      businessName,
      jurisdiction,
      document,
      generatedBy: 'legal-compliance',
      fallback: false,
      requiresLegalReview: true,
      reviewStatus: 'pending_legal_review',
      productionReadyWithoutReview: false,
      generatedAt: new Date().toISOString(),
      owner: req.user.id,
    });
    return res.json({
      success: true,
      document: doc,
      requiresLegalReview: true,
      message: 'Draft generated. Review it for the applicable jurisdiction before publishing or relying on it.',
    });
  } catch (error) {
    if (error?.code === 'plan_quota_exceeded' || error?.status === 402) return next(error);
    logger.error('Legal document generation failed', {
      error: error.message,
      code: error.code,
      type,
      userId: req.user?.id,
    });
    if (error?.code === 'legal_generation_unavailable') {
      return res.status(503).json({ error: error.message, code: error.code });
    }
    return res.status(503).json({
      error: 'The legal draft could not be generated right now. Nothing was saved.',
      code: 'legal_generation_failed',
    });
  }
});

export { LEGAL_TYPES, legalGenerationError, requireRealLegalDraft };
export default router;
