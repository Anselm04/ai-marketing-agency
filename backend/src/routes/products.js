import express from 'express';
import productMarketingService from '../services/productMarketingService.js';
import store from '../utils/store.js';
import { upload } from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';
import { requireMarketingEntitlement } from '../services/marketingEntitlementService.js';
import { createBusinessWorkspaceService } from '../services/businessWorkspaceService.js';

const router = express.Router();
const businesses = createBusinessWorkspaceService(store);

router.use(authenticate);

async function tagGeneratedResult(result, businessId) {
  if (!businessId || !result?.campaign?.id) return result;
  const campaign = await store.updateCampaign(result.campaign.id, { businessId });
  const contentItems = await Promise.all((result.contentItems || []).map((item) =>
    store.updateContent(item.id, { businessId })
  ));
  return { ...result, campaign, contentItems };
}

// POST /api/products/marketing
// Accepts product photos (multipart) + text fields and creates a saved campaign.
router.post('/marketing', requireMarketingEntitlement, upload.array('photos', 10), async (req, res, next) => {
  try {
    const {
      productName,
      description,
      platforms,
      targetAudience,
      budget,
      category,
      tone,
      businessId,
    } = req.body;

    if (!description && !req.files?.length) {
      return res.status(400).json({ error: 'Please provide a product description or upload photos' });
    }

    if (businessId) await businesses.requireOwnedBusiness(req.user.id, businessId);

    const parsedPlatforms = platforms
      ? (Array.isArray(platforms) ? platforms : platforms.split(',').map(p => p.trim()).filter(Boolean))
      : ['TikTok', 'Instagram', 'Google', 'LinkedIn', 'Facebook'];

    const parsedBudget = budget === undefined || budget === null || budget === '' ? 1000 : Number(budget);
    if (Number.isNaN(parsedBudget) || parsedBudget < 0) {
      return res.status(400).json({ error: 'Budget must be zero or a positive number' });
    }

    const photos = req.files?.map(file => ({
      url: `/uploads/${req.userId}/${file.filename}`,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    })) || [];

    let result = await productMarketingService.runMarketing({
      productName: productName || 'Untitled Product',
      description: description || '',
      photos,
      platforms: parsedPlatforms,
      targetAudience: targetAudience || 'general consumers',
      budget: parsedBudget,
      category: category || 'other',
      tone: tone || 'professional',
      ownerId: req.user.id,
    });

    result = await tagGeneratedResult(result, businessId || null);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/portfolio
// Personal AppForge portfolio. Every authenticated user can see only their own products.
router.get('/portfolio', async (req, res) => {
  const content = await store.getContentByOwner(req.user.id);
  const products = content
    .filter((item) => item.kind === 'appforge_portfolio_product')
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  res.json(products);
});

// POST /api/products/portfolio/:id/activate
// Starts Marketing for one AppForge product after the user has paid or redeemed access.
router.post('/portfolio/:id/activate', requireMarketingEntitlement, async (req, res, next) => {
  try {
    const businessId = req.body?.businessId || null;
    if (businessId) await businesses.requireOwnedBusiness(req.user.id, businessId);

    const content = await store.getContentByOwner(req.user.id);
    const portfolioProduct = content.find(
      (item) => item.id === req.params.id && item.kind === 'appforge_portfolio_product',
    );
    if (!portfolioProduct) {
      return res.status(404).json({ error: 'Portfolio product not found' });
    }

    const campaigns = await store.getCampaignsByOwner(req.user.id);
    const existing = campaigns.find(
      (campaign) =>
        campaign.portfolioProductId === portfolioProduct.id
        || (
          campaign.source === 'appforge'
          && campaign.sourceProjectId === portfolioProduct.sourceProjectId
        ),
    );

    if (existing) {
      const campaign = businessId && existing.businessId !== businessId
        ? await store.updateCampaign(existing.id, { businessId })
        : existing;
      if (businessId) {
        const linkedContent = (await store.getContentByOwner(req.user.id)).filter((item) => item.campaignId === existing.id);
        await Promise.all(linkedContent.map((item) => store.updateContent(item.id, { businessId })));
      }
      const updatedPortfolio = await store.updateContent(portfolioProduct.id, {
        ...(businessId ? { businessId } : {}),
        autoMarketingEligible: true,
        entitlementSource: req.marketingEntitlement?.source || null,
        marketingStatus: campaign.status === 'draft' ? 'draft_created' : 'campaign_generated',
        campaignId: campaign.id,
        updatedAt: new Date().toISOString(),
      });
      return res.json({ success: true, replayed: true, portfolioProduct: updatedPortfolio, campaign });
    }

    let generated = await productMarketingService.runMarketing({
      productName: portfolioProduct.productName,
      description: portfolioProduct.description || '',
      photos: [],
      platforms: ['TikTok', 'Instagram', 'Google', 'LinkedIn', 'Facebook'],
      targetAudience: 'general consumers',
      budget: 1000,
      category: 'software',
      tone: 'professional',
      ownerId: req.user.id,
    });
    generated = await tagGeneratedResult(generated, businessId);

    const campaign = await store.updateCampaign(generated.campaign.id, {
      source: 'appforge',
      sourceRequestId: `appforge:${req.user.id}:${portfolioProduct.sourceProjectId}:portfolio-activation`,
      sourceProjectId: portfolioProduct.sourceProjectId,
      sourceProjectCreatedAt: portfolioProduct.sourceProjectCreatedAt || null,
      sourceUserEmail: req.user.email,
      sourceUserName: portfolioProduct.sourceUserName || '',
      techStack: portfolioProduct.techStack || '',
      productUrl: portfolioProduct.productUrl || '',
      portfolioProductId: portfolioProduct.id,
      appforgePortfolioProduct: true,
      entitlementSource: req.marketingEntitlement?.source || null,
      ...(businessId ? { businessId } : {}),
    });

    const updatedPortfolio = await store.updateContent(portfolioProduct.id, {
      ...(businessId ? { businessId } : {}),
      autoMarketingEligible: true,
      entitlementSource: req.marketingEntitlement?.source || null,
      marketingStatus: 'campaign_generated',
      campaignId: campaign.id,
      updatedAt: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      replayed: false,
      portfolioProduct: updatedPortfolio,
      campaign,
      generated: {
        contentItems: generated.contentItems?.length || 0,
        hasStrategy: Boolean(generated.strategy),
        hasSeo: Boolean(generated.seoKeywords),
        hasSocialPosts: Boolean(generated.socialPosts),
        hasAdCopy: Boolean(generated.adCopy),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products
// List product marketing campaigns for the authenticated user, optionally by business.
router.get('/', async (req, res, next) => {
  try {
    const businessId = req.query.businessId ? String(req.query.businessId) : null;
    if (businessId) await businesses.requireOwnedBusiness(req.user.id, businessId);
    const campaigns = businesses.filterByBusiness(
      await store.getCampaignsByOwner(req.user.id),
      businessId,
    )
      .filter((campaign) => campaign.productName)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id
// Get full details of a product marketing campaign including generated content.
router.get('/:id', async (req, res) => {
  const campaigns = await store.getCampaignsByOwner(req.user.id);
  const campaign = campaigns.find((item) => item.id === req.params.id);
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const contentItems = (await store.getContentByOwner(req.user.id)).filter(
    (item) => item.campaignId === campaign.id,
  );

  res.json({ campaign, contentItems });
});

export default router;
