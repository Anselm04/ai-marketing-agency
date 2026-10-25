import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import schedulerService from '../services/schedulerService.js';

const router = express.Router();

router.use(authenticate);

router.get('/jobs', requireAdmin, async (req, res) => {
  try {
    return res.json(await schedulerService.listJobs(req.user.id));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message, code: error.code || null });
  }
});

router.post('/jobs', requireAdmin, async (req, res) => {
  try {
    const { id, cronExpression, agentId, task, context } = req.body || {};
    const result = await schedulerService.scheduleJob({
      ownerId: req.user.id,
      id,
      cronExpression,
      agentId,
      task,
      context: context || {},
    });
    return res.status(201).json(result);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message, code: error.code || null });
  }
});

router.delete('/jobs/:id', requireAdmin, async (req, res) => {
  try {
    const result = await schedulerService.cancelJob(req.user.id, req.params.id);
    return res.status(result.cancelled ? 200 : 404).json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message, code: error.code || null });
  }
});

router.post('/run-hourly', requireAdmin, async (_req, res) => {
  try {
    await schedulerService.runHourlyTasks();
    return res.json({ success: true });
  } catch (error) {
    return res.status(error.statusCode || 409).json({ error: error.message, code: error.code || null, success: false });
  }
});

router.post('/run-daily', requireAdmin, async (_req, res) => {
  try {
    await schedulerService.runDailyTasks();
    return res.json({ success: true });
  } catch (error) {
    return res.status(error.statusCode || 409).json({ error: error.message, code: error.code || null, success: false });
  }
});

export default router;