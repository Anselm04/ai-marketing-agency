import express from 'express';
import store from '../utils/store.js';
import productMarketingService from '../services/productMarketingService.js';
import { requireEcosystemSignature } from '../services/ecosystemSignature.js';
import { withEcosystemLock } from '../services/ecosystemLock.js';
import { logger } from '../utils/logger.js';
import { isOwnerEmail } from '../utils/owner.js';
import { getMarketingEntitlement } from '../services/marketingEntitlementService.js';

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
  const marketingUser = await store.findUserByEmail(normalizedEmail);
  if (!marketingUser) {
    return res.status(409).json({
      error: 'Create or sign in to a TrillionAI Marketing account with the same email before importing this AppForge product.',
      code: 'marketing_account_required',
      marketingAccountRequired: true,
    });
  }

  const sourceRequestId = `appforge:${sourceProjectId}:${sourceProjectCreatedAt || 'unknown'}`;
  const portfolioKey = `appforge-product:${sourceProjectId}`;

  try {
    return await withEcosystemLock(sourceRequestId, async () => {
      const userContent = await store.getContentByOwner(marketingUser.id);
      const existingPortfolio = userContent.find(
        (item) => item.kind === 'appforge_portfolio_product' && item.portfolioKey === portfolioKey,
      );

      const entitlement = await getMarketingEntitlement(marketingUser);
      const ownerAccount = isOwnerEmail(marketingUser.email);

      const portfolioPayload = {
        kind: 'appforge_portfolio_product',
        owner: marketingUser.id,
        ownerId: marketingUser.id,
        portfolioKey,
        source: 'appforge',
        sourceProjectId,
        sourceProjectCreatedAt: sourceProjectCreatedAt || null,
        sourceUserEmail: normalizedEmail,
        sourceUserName: typeof sourceUserName === 'string' ? sourceUserName : '',
        productName: productName.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        techStack: typeof techStack === 'string' ? techStack : '',
        productUrl: typeof productUrl === 'string' ? productUrl : '',
        ownerAccount,
        autoMarketingEligible: entitlement.allowed,
        billingRequired: !entitlement.allowed,
        marketingAccessSource: entitlement.source,
        marketingPlan: entitlement.plan,
        marketingStatus: entitlement.allowed
          ? (mode === 'generate' ? 'campaign_requested' : 'ready')
          : 'payment_required',
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
          campaign.sourceRequestId === sourceRequestId
          && (campaign.owner === marketingUser.id || campaign.ownerId === marketingUser.id),
      );

      if (existing) {
        return res.status(200).json({
          success: true,
          replayed: true,
          portfolioAdded: true,
          billingRequired: false,
          automatedMarketing: existing.status !== 'draft',
          portfolioProduct,
          campaign: existing,
        });
      }

      if (!entitlement.allowed) {
        logger.info('AppForge product added to user portfolio but Marketing access is locked', {
          sourceProjectId,
          marketingUserId: marketingUser.id,
        });
        return res.status(402).json({
          success: false,
          portfolioAdded: true,
          billingRequired: true,
          automatedMarketing: false,
          code: 'marketing_access_required',
          message: 'Product saved to your Marketing portfolio. Subscribe or redeem a valid god code to generate and run marketing.',
          portfolioProduct,
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
          appforgePortfolioProduct: true,
          ownerAccount,
        });

        await store.updateContent(portfolioProduct.id, {
          marketingStatus: 'campaign_generated',
          campaignId: campaign?.id || null,
          billingRequired: false,
          autoMarketingEligible: true,
          updatedAt: new Date().toISOString(),
        });

        logger.info('Generated Marketing campaign from AppForge project', {
          sourceProjectId,
          marketingUserId: marketingUser.id,
          campaignId: campaign?.id,
        });

        return res.status(201).json({
          success: true,
          replayed: false,
          portfolioAdded: true,
          billingRequired: false,
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
        appforgePortfolioProduct: true,
        ownerAccount,
      });

      await store.updateContent(portfolioProduct.id, {
        marketingStatus: 'draft_created',
        campaignId: campaign.id,
        billingRequired: false,
        autoMarketingEligible: true,
        updatedAt: new Date().toISOString(),
      });

      logger.info('Created Marketing draft from AppForge project', {
        sourceProjectId,
        marketingUserId: marketingUser.id,
        campaignId: campaign.id,
      });

      return res.status(201).json({
        success: true,
        replayed: false,
        portfolioAdded: true,
        billingRequired: false,
        automatedMarketing: false,
        portfolioProduct,
        campaign,
      });
    });
  } catch (error) {
    logger.error('AppForge Marketing intake failed', {
      error: error?.message,
      sourceProjectId,
      marketingUserId: marketingUser.id,
    });
    return res.status(500).json({ error: 'Unable to process AppForge product for Marketing' });
  }
});

export default router;
