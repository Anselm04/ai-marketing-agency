import express from 'express';
import { authenticate } from '../middleware/auth.js';
import translationService from '../services/translationService.js';

const router = express.Router();

router.use(authenticate);

router.get('/languages', (req, res) => {
  res.json(translationService.getSupportedLanguages());
});

router.post('/translate', async (req, res) => {
  const { content, targetLanguage, sourceLanguage } = req.body;
  const result = await translationService.translate(content, targetLanguage, sourceLanguage);
  res.json(result);
});

router.post('/translate-multiple', async (req, res) => {
  const { content, languages } = req.body;
  const results = await translationService.translateToMultiple(content, languages);
  res.json(results);
});

router.post('/detect', async (req, res) => {
  const { text } = req.body;
  const language = await translationService.detectLanguage(text);
  res.json({ language });
});

export default router;
