import express from 'express';

const router = express.Router();

router.use((_req, res) => res.status(503).json({
  error: 'Team collaboration is not available until shared-workspace tenancy is production-ready.',
  code: 'team_collaboration_unavailable',
}));

export default router;
