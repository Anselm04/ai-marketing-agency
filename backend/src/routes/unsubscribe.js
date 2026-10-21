import express from 'express';
import store from '../utils/store.js';
import {
  suppressMarketingLead,
  verifyUnsubscribeToken,
} from '../services/marketingEmailConsentService.js';

const router = express.Router();

async function unsubscribe(req, res) {
  try {
    const token = req.query?.token || req.body?.token;
    const payload = verifyUnsubscribeToken(token);
    const leads = await store.getLeadsByOwner(payload.ownerId);
    const lead = leads.find((item) => String(item.id) === String(payload.leadId));
    if (!lead || String(lead.email || '').trim().toLowerCase() !== payload.email) {
      return res.status(400).json({ error: 'Unsubscribe link is no longer valid.', code: 'invalid_unsubscribe_target' });
    }
    await suppressMarketingLead({ ownerId: payload.ownerId, leadId: payload.leadId, reason: 'recipient_unsubscribe' });
    if (req.method === 'GET') {
      return res.type('html').send('<!doctype html><html><body style="font-family:sans-serif;padding:32px"><h1>Unsubscribed</h1><p>You will no longer receive marketing email from this sender through AI Marketing Agency.</p></body></html>');
    }
    return res.status(200).send('');
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message || 'Unable to unsubscribe.', code: error.code || 'unsubscribe_failed' });
  }
}

router.get('/', unsubscribe);
router.post('/', express.urlencoded({ extended: false }), unsubscribe);

export default router;
