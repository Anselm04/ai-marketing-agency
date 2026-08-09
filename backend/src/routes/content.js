import express from 'express';
import store from '../utils/store.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import contentStudio from '../services/contentStudio.js';
import translationService from '../services/translationService.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const content = (await store.getContent()).filter(c => c.owner === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(content);
});

router.post('/',
  validateBody({ title: { required: true, type: 'string' }, type: { required: true, type: 'string' }, body: { required: true, type: 'string' } }),
  async (req, res) => {
    const content = await store.createContent({ ...req.body, owner: req.user.id });
    res.status(201).json(content);
  }
);

router.post('/generate', async (req, res) => {
  const { type, topic, platform, keywords, tone } = req.body;
  let result;
  if (type === 'article') result = await contentStudio.generateArticle(topic, keywords || [], tone, req.body.length);
  else if (type === 'ad_copy') result = await contentStudio.generateAdCopy(platform, topic, req.body.audience, req.body.cta);
  else if (type === 'script') result = await contentStudio.generateScript(req.body.videoType, topic, req.body.duration);
  else if (type === 'email') result = await contentStudio.generateEmail(req.body.emailType, req.body.recipient, topic, tone);
  else result = await contentStudio.generateArticle(topic, keywords || [], tone, 500);
  res.json(result);
});

router.post('/bulk-generate', async (req, res) => {
  const { type, topics, platform } = req.body;
  const results = await contentStudio.bulkGenerate(type, topics, platform, req.user.id);
  res.json(results);
});

router.post('/:id/translate', async (req, res) => {
  const content = (await store.getContent()).find(c => c.id === req.params.id && c.owner === req.user.id);
  if (!content) return res.status(404).json({ error: 'Content not found' });
  const { languages } = req.body;
  const results = await translationService.translateToMultiple(content.body, languages);
  await store.updateContent(content.id, { translations: results.map(r => ({ language: r.language, body: r.translated, autoTranslated: r.auto })) });
  res.json((await store.getContent()).find(c => c.id === req.params.id));
});

router.post('/:id/seo', async (req, res) => {
  const content = (await store.getContent()).find(c => c.id === req.params.id && c.owner === req.user.id);
  if (!content) return res.status(404).json({ error: 'Content not found' });
  const result = await contentStudio.optimizeSeo(content.body, req.body.keywords || []);
  res.json(result);
});

export default router;
