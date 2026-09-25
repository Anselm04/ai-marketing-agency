import express from 'express';
import store from '../utils/store.js';
import productMarketingService from '../services/productMarketingService.js';
import { requireEcosystemSignature } from '../services/ecosystemSignature.js';
import { withEcosystemLock } from '../services/ecosystemLock.js';
import { logger } from '../utils/logger.js';
import { canonicalOwnerEmail, isOwnerEmail } from '../utils/owner.js';

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
  if (
    typeof sourceUserEmail !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sourceUserEmail.trim())
  ) {
    return res.status(400).json({ error: 'A valid sourceUserEmail is required' });
  }
  if (
    typeof productName !== 'string' ||
    !productName.trim() ||
    productName.trim().length > 255
  ) {
    return res.status(400).json({ error: 'A valid productName is required' });
  }
  if (typeof description === 'string' && description.length > 20_000) {
    return res.status(400).json({ error: 'Description is too large' });
  }
  if (!['draft', 'generate'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be draft or generate' });
  }
  if (productUrl) {
    try {
      const parsed = new URL(productUrl);
      if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
        return res.status(400).json({ error: 'Production product URLs must use HTTPS' });
      }
    } catch {
      return res.status(400).json({ error: 'productUrl must be a valid URL' });
    }
  }

  const normalizedEmail = sourceUserEmail.trim().toLowerCase();

  // AppForge may build products for many customers, but automatic portfolio intake
  // and advertising are deliberately restricted to the canonical TrillionAI owner.
  // Non-owner AppForge products are acknowledged and ignored so they can never be
  // silently added to or marketed from the owner's personal Marketing account.
  if (!isOwnerEmail(normalizedEmail)) {
    logger.info('Ignored non-owner AppForge product for automatic Marketing intake', {
      sourceProjectId,
    });
    return res.status(202).json({
      success: true,
      accepted: true,
      ownerPortfolioAdded: false,
      automatedMarketing: false,
      code: 'non_owner_appforge_product_ignored',
    });
  }

  const marketingUser = await store.findUserByEmail(canonicalOwnerEmail());
  if (!marketingUser) {
    return res.status(409).json({
      error: 'Owner TrillionAI Marketing account required',
      code: 'owner_marketing_account_required',
    });
  }

  const sourceRequestId = `appforge:${sourceProjectId}:${sourceProjectCreatedAt || 'unknown'}`;
  const portfolioKey = `appforge-product:${sourceProjectId}`;

  try {
    return await withEcosystemLock(sourceRequestId, async () => {
      const ownerContent = await store.getContentByOwner(marketingUser.id);
      const existingPortfolio = ownerContent.find(
        (item) => item.kind === 'owner_portfolio_product' && item.portfolioKey === portfolioKey,
      );

      const portfolioPayload = {
        kind: 'owner_portfolio_product',
        owner: marketingUser.id,
        ownerId: marketingUser.id,
        portfolioKey,
        source: 'appforge',
        sourceProjectId,
        sourceProjectCreatedAt: sourceProjectCreatedAt || null,
        sourceUserEmail: canonicalOwnerEmail(),
        sourceUserName: typeof sourceUserName === 'string' ? sourceUserName : '',
        productName: productName.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        techStack: typeof techStack === 'string' ? techStack : '',
        productUrl: typeof productUrl === 'string' ? productUrl : '',
        autoMarketingEligible: true,
        ownerOnly: true,
        marketingStatus: mode === 'generate' ? 'campaign_requested' : 'ready',
        updatedAt: new Date().toISOString(),
      };

      const portfolioProduct = existingPortfolio
        ? await store.updateContent(existingPortfolio.id, portfolioPayload)
        : await store.createContent({
            ...portfolioPayload,
            createdAt: new Date().toISOString(),
          });

      const campaigns = await store.getCampaignsByOwner(marketingUser.id);
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
          portfolioProduct,
          ownerPortfolioAdded: true,
          automatedMarketing: existing.status !== 'draft',
        });
      }

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
          portfolioProductId: portfolioProduct.id,
          ownerPortfolioProduct: true,
        });

        logger.info('Generated marketing campaign from AppForge project', {
          sourceProjectId,
          marketingUserId: marketingUser.id,
          campaignId: campaign?.id,
        });

        await store.updateContent(portfolioProduct.id, {
          marketingStatus: 'campaign_generated',
          campaignId: campaign?.id || null,
          updatedAt: new Date().toISOString(),
        });

        return res.status(201).json({
          success: true,
          replayed: false,
          ownerPortfolioAdded: true,
          automatedMarketing: true,
          portfolioProduct,
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
        portfolioProductId: portfolioProduct.id,
        ownerPortfolioProduct: true,
      });

      logger.info('Created marketing draft from AppForge project', {
        sourceProjectId,
        marketingUserId: marketingUser.id,
        campaignId: campaign.id,
      });

      await store.updateContent(portfolioProduct.id, {
        marketingStatus: 'draft_created',
        campaignId: campaign.id,
        updatedAt: new Date().toISOString(),
      });

      return res.status(201).json({
        success: true,
        replayed: false,
        ownerPortfolioAdded: true,
        automatedMarketing: false,
        portfolioProduct,
        campaign,
      });
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
