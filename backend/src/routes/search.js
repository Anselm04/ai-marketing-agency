import express from 'express';
import store from '../utils/store.js';
import { authenticate } from '../middleware/auth.js';
import { searchOwnedEntities } from '../services/productionSearchService.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { q, type } = req.query;
  if (!q || q.length < 2) return res.json({ results: [] });

  try {
    const results = await searchOwnedEntities({
      adapter: store,
      ownerId: req.user.id,
      query: q,
      type,
    });
    return res.json({ results, query: q, total: results.length });
  } catch {
    return res.status(500).json({
      error: 'Unable to search marketing workspace data.',
      code: 'workspace_search_failed',
    });
  }
});

export default router;
