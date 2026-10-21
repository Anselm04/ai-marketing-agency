import express from 'express';
import store from '../utils/store.js';
import {
  consentStatus,
  grantMarketingConsent,
  suppressMarketingLead,
} from '../services/marketingEmailConsentService.js';
import { sendMarketingEmailToLead } from '../services/marketingEmailService.js';

const router = express.Router();

async function ownerLead(ownerId, leadId) {
  const leads = await store.getLeadsByOwner(ownerId);
  return leads.find((lead) => String(lead.id) === String(leadId)) || null;
}

router.get('/leads', async (req, res) => {
  const leads = (await store.getLeadsByOwner(req.user.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);
  res.json(leads.map((lead) => ({ ...lead, marketingEmailStatus: consentStatus(lead) })));
});

router.post('/leads', async (req, res) => {
  const lead = await store.createLead({
    ...req.body,
    marketingConsent: req.body?.marketingConsent?.status === 'granted'
      ? { ...req.body.marketingConsent, status: 'unknown', grantedAt: null }
      : req.body?.marketingConsent,
    marketingSuppressed: req.body?.marketingSuppressed === true,
    owner: req.user.id,
  });
  res.status(201).json({ ...lead, marketingEmailStatus: consentStatus(lead) });
});

router.get('/leads/:id', async (req, res) => {
  const lead = await ownerLead(req.user.id, req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json({ ...lead, marketingEmailStatus: consentStatus(lead) });
});

router.patch('/leads/:id', async (req, res) => {
  const lead = await ownerLead(req.user.id, req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const safeUpdates = { ...req.body };
  delete safeUpdates.owner;
  delete safeUpdates.ownerId;
  delete safeUpdates.marketingConsent;
  delete safeUpdates.marketingSuppressed;
  delete safeUpdates.unsubscribed;
  await store.updateLead(lead.id, safeUpdates);
  const updated = await ownerLead(req.user.id, req.params.id);
  res.json({ ...updated, marketingEmailStatus: consentStatus(updated) });
});

router.post('/leads/:id/marketing-consent', async (req, res, next) => {
  try {
    const updated = await grantMarketingConsent({
      ownerId: req.user.id,
      leadId: req.params.id,
      source: req.body?.source,
      evidence: req.body?.evidence,
    });
    res.json({ ...updated, marketingEmailStatus: consentStatus(updated) });
  } catch (error) {
    next(error);
  }
});

router.delete('/leads/:id/marketing-consent', async (req, res, next) => {
  try {
    const updated = await suppressMarketingLead({
      ownerId: req.user.id,
      leadId: req.params.id,
      reason: req.body?.reason || 'owner_revoked',
    });
    res.json({ ...updated, marketingEmailStatus: consentStatus(updated) });
  } catch (error) {
    next(error);
  }
});

router.post('/leads/:id/marketing-email', async (req, res, next) => {
  try {
    const result = await sendMarketingEmailToLead({
      ownerId: req.user.id,
      leadId: req.params.id,
      subject: req.body?.subject,
      html: req.body?.html,
      text: req.body?.text,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/leads/:id', async (req, res) => {
  const lead = await ownerLead(req.user.id, req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  await store.deleteLead(lead.id);
  res.json({ success: true });
});

export default router;
