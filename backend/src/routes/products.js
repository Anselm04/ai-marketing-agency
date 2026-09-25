import express from 'express';
import productMarketingService from '../services/productMarketingService.js';
import store from '../utils/store.js';
import { upload } from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';
import { requireMarketingEntitlement } from '../services/marketingEntitlementService.js';

const router = express.Router();

router.use(authenticate);

// POST /api/products/marketing
// Accepts product photos (multipart) + text fields
// Runs AI analysis and generates complete marketing campaign
router.post('/marketing', requireMarketingEntitlement, upload.array('photos', 10), async (req, res) => {
  try {
    const {
      productName,
      description,
      platforms,
      targetAudience,
      budget,
      category,
      tone,
    } = req.body;

    if (!description && !req.files?.length) {
      return res.status(400).json({ error: 'Please provide a product description or upload photos' });
    }

    const parsedPlatforms = platforms
      ? (Array.isArray(platforms) ? platforms : platforms.split(',').map(p => p.trim()).filter(Boolean))
      : ['TikTok', 'Instagram', 'Google', 'LinkedIn', 'Facebook'];

    const parsedBudget = budget ? Number(budget) : 1000;
    if (isNaN(parsedBudget) || parsedBudget < 0) {
      return res.status(400).json({ error: 'Budget must be a positive number' });
    }

    const photos = req.files?.map(file => ({
      url: `/uploads/${req.userId}/${file.filename}`,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    })) || [];

    const result = await productMarketingService.runMarketing({
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

    res.status(201).json(result);
  } catch (err) {
    console.error('Product marketing error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate marketing campaign' });
  }
});

// GET /api/products/portfolio
// Personal AppForge portfolio. Every authenticated user sees only their own products.
router.get('/portfolio', async (req, res) => {
  const content = await store.getContentByOwner(req.user.id);
  const products = content
    .filter((item) => item.kind === 'appforge_portfolio_product')
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  res.json(products);
});

// GET /api/products
// List all product marketing campaigns for the authenticated user
router.get('/', async (req, res) => {
  const campaigns = (await store.getCampaignsByOwner(req.user.id))
    .filter((campaign) => campaign.productName)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(campaigns);
});

// GET /api/products/:id
// Get full details of a product marketing campaign including generated content
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
