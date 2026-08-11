import express from 'express';
import productMarketingService from '../services/productMarketingService.js';
import store from '../utils/store.js';
import { upload } from '../middleware/upload.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public product catalog — no authentication required for browsing
router.get('/catalog', async (req, res) => {
  const products = await store.getProducts();
  res.json(products.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    currency: p.currency || 'NZD',
    billingType: p.billingType,
    billingInterval: p.billingInterval,
    trialPeriod: p.trialPeriod,
    stripeProductId: p.stripeProductId,
    features: p.features,
    images: p.images,
    status: p.status,
    createdAt: p.createdAt,
  })));
});

router.get('/catalog/:id', async (req, res) => {
  const product = await store.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    currency: product.currency || 'NZD',
    billingType: product.billingType,
    billingInterval: product.billingInterval,
    trialPeriod: product.trialPeriod,
    stripeProductId: product.stripeProductId,
    features: product.features,
    images: product.images,
    status: product.status,
    createdAt: product.createdAt,
  });
});

// Authenticated marketing campaigns (existing)
router.use(authenticate);

// POST /api/products/marketing
// Accepts product photos (multipart) + text fields
// Runs AI analysis and generates complete marketing campaign
router.post('/marketing', upload.array('photos', 10), async (req, res) => {
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

// GET /api/products
// List all product marketing campaigns for the authenticated user
router.get('/', (req, res) => {
  const campaigns = store.getCampaigns().filter(
    c => c.owner === req.user.id && c.productName
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(campaigns);
});

// GET /api/products/:id
// Get full details of a product marketing campaign including generated content
router.get('/:id', (req, res) => {
  const campaign = store.getCampaignById(req.params.id);
  if (!campaign || campaign.owner !== req.user.id) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const contentItems = store.getContent().filter(
    c => c.campaignId === campaign.id && c.owner === req.user.id
  );

  res.json({ campaign, contentItems });
});

// Admin: create product
router.post('/catalog', requireAdmin, async (req, res) => {
  const product = await store.createProduct(req.body);
  res.status(201).json(product);
});

// Admin: update product
router.put('/catalog/:id', requireAdmin, async (req, res) => {
  const product = await store.updateProduct(req.params.id, req.body);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

export default router;
