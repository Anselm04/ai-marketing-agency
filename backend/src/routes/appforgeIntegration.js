import express from 'express';
import store from '../utils/store.js';
import productMarketingService from '../services/productMarketingService.js';
import { requireEcosystemSignature } from '../services/ecosystemSignature.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.use(requireEcosystemSignature);

router.post('/campaign', async (req, res) => {
  const {
    source,
    sourceProjectId,
    sourceProjectCreatedAt,
    sourceUserEmail,
    sourceUserName,
    productName,
    description,
    techStack,
    productUrl,
    mode = 'draft',
  } = req.body ?? {};

  if (source !== 'appforge') {
    return res.status(400).json({ error: 'Invalid ecosystem source' });
  }
  if (!Number.isSafeInteger(sourceProjectId) || sourceProjectId <= 0) {
    return res.status(400).json({ error: 'A valid sourceProjectId is required' });
  }
  if (typeof sourceUserEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sourceUserEmail.trim())) {
    return res.status(400).json({ error: 'A valid sourceUserEmail is required' });
  }
  if (typeof productName !== 'string' || !productName.trim()) {
    return res.status(400).json({ error: 'productName is required' });
  }
  if (!['draft', 'generate'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be draft or generate' });
  }

  const normalizedEmail = sourceUserEmail.trim().toLowerCase();
  const marketingUser = await store.findUserByEmail(normalizedEmail);
  if (!marketingUser) {
    return res.status(409).json({
      error: 'Matching TrillionAI Marketing account required',
      code: 'marketing_account_required',
    });
  }

  const sourceRequestId = `appforge:${sourceProjectId}:${sourceProjectCreatedAt || 'unknown'}`;
  const campaigns = await store.getCampaigns();
  const existing = campaigns.find(
    (campaign) =>
      campaign.owner === marketingUser.id &&
      campaign.sourceRequestId === sourceRequestId,
  );

  if (existing) {
    return res.status(200).json({
      success: true,
      replayed: true,
      campaign: existing,
    });
  }

  try {
    if (mode === 'generate') {
      const generated = await productMarketingService.runMarketing({
        productName: productName.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        photos: [],
        platforms: ['TikTok', 'Instagram', 'Google', 'LinkedIn', 'Facebook'],
        targetAudience: 'general consumers',
        budget: 1000,
        category: 'software',
        tone: 'professional',
        ownerId: marketingUser.id,
      });

      const campaign = await store.updateCampaign(generated.campaign.id, {
        source: 'appforge',
        sourceRequestId,
        sourceProjectId,
        sourceProjectCreatedAt: sourceProjectCreatedAt || null,
        sourceUserEmail: normalizedEmail,
        sourceUserName: typeof sourceUserName === 'string' ? sourceUserName : '',
        techStack: typeof techStack === 'string' ? techStack : '',
        productUrl: typeof productUrl === 'string' ? productUrl : '',
      });

      logger.info('Generated marketing campaign from AppForge project', {
        sourceProjectId,
        marketingUserId: marketingUser.id,
        campaignId: campaign?.id,
      });

      return res.status(201).json({
        success: true,
        replayed: false,
        campaign,
        generated: {
          contentItems: generated.contentItems?.length || 0,
          hasStrategy: Boolean(generated.strategy),
          hasSeo: Boolean(generated.seoKeywords),
          hasSocialPosts: Boolean(generated.socialPosts),
          hasAdCopy: Boolean(generated.adCopy),
        },
      });
    }

    const campaign = await store.createCampaign({
      name: `AppForge Launch: ${productName.trim()}`,
      productName: productName.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      platforms: ['TikTok', 'Instagram', 'Google', 'LinkedIn', 'Facebook'],
      targetAudience: 'general consumers',
      category: 'software',
      tone: 'professional',
      status: 'draft',
      owner: marketingUser.id,
      source: 'appforge',
      sourceRequestId,
      sourceProjectId,
      sourceProjectCreatedAt: sourceProjectCreatedAt || null,
      sourceUserEmail: normalizedEmail,
      sourceUserName: typeof sourceUserName === 'string' ? sourceUserName : '',
      techStack: typeof techStack === 'string' ? techStack : '',
      productUrl: typeof productUrl === 'string' ? productUrl : '',
    });

    logger.info('Created marketing draft from AppForge project', {
      sourceProjectId,
      marketingUserId: marketingUser.id,
      campaignId: campaign.id,
    });

    return res.status(201).json({
      success: true,
      replayed: false,
      campaign,
    });
  } catch (error) {
    logger.error('AppForge marketing intake failed', {
      error: error?.message,
      sourceProjectId,
      marketingUserId: marketingUser.id,
    });
    return res.status(500).json({ error: 'Unable to create marketing campaign' });
  }
});

export default router;
