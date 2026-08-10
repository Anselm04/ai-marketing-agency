import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import schedulerService from '../services/schedulerService.js';

const router = express.Router();

router.use(authenticate);

router.get('/jobs', requireAdmin, (req, res) => {
  res.json(schedulerService.listJobs());
});

router.post('/jobs', requireAdmin, (req, res) => {
  const { id, cronExpression, agentId, task, context } = req.body;
  const result = schedulerService.scheduleJob(id, cronExpression, agentId, task, context || {});
  res.json(result);
});

router.delete('/jobs/:id', requireAdmin, (req, res) => {
  const result = schedulerService.cancelJob(req.params.id);
  res.json(result);
});

router.post('/run-hourly', requireAdmin, async (req, res) => {
  await schedulerService.runHourlyTasks();
  res.json({ success: true });
});

router.post('/run-daily', requireAdmin, async (req, res) => {
  await schedulerService.runDailyTasks();
  res.json({ success: true });
});

export default router;
