import crypto from 'crypto';
import store from '../utils/store.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function secret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || null;
}

function encode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function createUnsubscribeToken({ ownerId, leadId, email, now = Date.now() }) {
  const signingSecret = secret();
  if (!signingSecret) {
    throw Object.assign(new Error('Marketing unsubscribe signing is not configured.'), {
      status: 503,
      code: 'unsubscribe_signing_not_configured',
    });
  }
  const payload = {
    ownerId: String(ownerId),
    leadId: String(leadId),
    email: normalizeEmail(email),
    exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = encode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', signingSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyUnsubscribeToken(token, now = Date.now()) {
  const signingSecret = secret();
  if (!signingSecret) {
    throw Object.assign(new Error('Marketing unsubscribe signing is not configured.'), {
      status: 503,
      code: 'unsubscribe_signing_not_configured',
    });
  }
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) throw Object.assign(new Error('Invalid unsubscribe token.'), { status: 400, code: 'invalid_unsubscribe_token' });
  const expected = crypto.createHmac('sha256', signingSecret).update(body).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw Object.assign(new Error('Invalid unsubscribe token.'), { status: 400, code: 'invalid_unsubscribe_token' });
  }
  let payload;
  try {
    payload = JSON.parse(decode(body));
  } catch {
    throw Object.assign(new Error('Invalid unsubscribe token.'), { status: 400, code: 'invalid_unsubscribe_token' });
  }
  if (!payload?.ownerId || !payload?.leadId || !payload?.email || Number(payload.exp) <= Math.floor(now / 1000)) {
    throw Object.assign(new Error('Unsubscribe token is invalid or expired.'), { status: 400, code: 'expired_unsubscribe_token' });
  }
  return payload;
}

export function consentStatus(lead) {
  const consent = lead?.marketingConsent || {};
  const suppressed = lead?.marketingSuppressed === true || consent.status === 'revoked' || lead?.unsubscribed === true;
  return {
    email: normalizeEmail(lead?.email),
    granted: consent.status === 'granted' && !suppressed,
    suppressed,
    status: suppressed ? 'suppressed' : (consent.status || 'unknown'),
    source: consent.source || null,
    grantedAt: consent.grantedAt || null,
    revokedAt: consent.revokedAt || null,
  };
}

export async function grantMarketingConsent({ ownerId, leadId, source, evidence = null }) {
  if (!source || !String(source).trim()) {
    throw Object.assign(new Error('Consent source is required.'), { status: 400, code: 'consent_source_required' });
  }
  const leads = await store.getLeadsByOwner(ownerId);
  const lead = leads.find((item) => String(item.id) === String(leadId));
  if (!lead) throw Object.assign(new Error('Lead not found.'), { status: 404, code: 'lead_not_found' });
  if (!normalizeEmail(lead.email)) throw Object.assign(new Error('Lead email is required.'), { status: 400, code: 'lead_email_required' });

  const now = new Date().toISOString();
  const marketingConsent = {
    status: 'granted',
    source: String(source).trim().slice(0, 200),
    evidence: evidence == null ? null : String(evidence).slice(0, 1000),
    grantedAt: now,
    revokedAt: null,
  };
  return store.updateLead(lead.id, {
    marketingConsent,
    marketingSuppressed: false,
    unsubscribed: false,
    updatedAt: now,
  });
}

export async function suppressMarketingLead({ ownerId, leadId, reason = 'unsubscribe' }) {
  const leads = await store.getLeadsByOwner(ownerId);
  const lead = leads.find((item) => String(item.id) === String(leadId));
  if (!lead) throw Object.assign(new Error('Lead not found.'), { status: 404, code: 'lead_not_found' });
  const now = new Date().toISOString();
  return store.updateLead(lead.id, {
    marketingSuppressed: true,
    unsubscribed: true,
    marketingConsent: {
      ...(lead.marketingConsent || {}),
      status: 'revoked',
      revokedAt: now,
      revocationReason: String(reason || 'unsubscribe').slice(0, 200),
    },
    updatedAt: now,
  });
}

export async function requireMarketingSendConsent(ownerId, leadId) {
  const leads = await store.getLeadsByOwner(ownerId);
  const lead = leads.find((item) => String(item.id) === String(leadId));
  if (!lead) throw Object.assign(new Error('Lead not found.'), { status: 404, code: 'lead_not_found' });
  const status = consentStatus(lead);
  if (!status.email) throw Object.assign(new Error('Lead email is required.'), { status: 400, code: 'lead_email_required' });
  if (!status.granted) {
    throw Object.assign(new Error('Marketing email blocked: explicit consent is not active for this lead.'), {
      status: 409,
      code: status.suppressed ? 'marketing_email_suppressed' : 'marketing_consent_required',
    });
  }
  return lead;
}
