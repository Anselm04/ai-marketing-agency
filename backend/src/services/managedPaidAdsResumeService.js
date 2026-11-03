import { getTokens } from './appConnector.js';

const META_BASE = 'https://graph.facebook.com/v26.0';
const GOOGLE_BASE = 'https://googleads.googleapis.com/v26';

function resumeError(message, code, statusCode = 409) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

async function tokenFor(userId, connectorId) {
  const tokens = await getTokens(userId, connectorId);
  if (!tokens?.accessToken) throw resumeError('Advertising provider is not connected.', 'paid_ads_provider_not_connected');
  return tokens.accessToken;
}

async function jsonRequest(url, options, code) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw resumeError('Advertising provider could not be reached.', code, 502);
  }
  let body = null;
  try { body = await response.json(); } catch { /* upstream can return empty bodies */ }
  if (!response.ok) {
    const detail = body?.error?.message || body?.message || `HTTP ${response.status}`;
    throw resumeError(`Advertising provider rejected the resume request: ${detail}`, code, 502);
  }
  return body ?? {};
}

async function metaPost(path, token, values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, String(value));
  return jsonRequest(`${META_BASE}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }, 'meta_ads_resume_failed');
}

async function googlePost(path, token, body, loginCustomerId = null) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (loginCustomerId) headers['login-customer-id'] = String(loginCustomerId).replace(/\D/g, '');
  return jsonRequest(`${GOOGLE_BASE}/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }, 'google_ads_resume_failed');
}

export async function resumeManagedPaidAdCampaign(userId, budget) {
  if (!budget?.providerCampaignId) return { resumed: true, alreadyAbsent: true };

  if (budget.provider === 'meta') {
    const token = await tokenFor(userId, 'meta_ads');
    await metaPost(budget.providerCampaignId, token, { status: 'ACTIVE' });
    return { resumed: true };
  }

  if (budget.provider === 'google') {
    const token = await tokenFor(userId, 'google_ads');
    const customerId = String(budget.providerAccountId || '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(customerId)) throw resumeError('Google Ads customer id must contain 10 digits.', 'google_ads_customer_invalid');
    const loginCustomerId = budget.providerAccount?.loginCustomerId || null;
    const resourceName = budget.providerCampaignResourceName || `customers/${customerId}/campaigns/${budget.providerCampaignId}`;
    await googlePost(`customers/${customerId}/campaigns:mutate`, token, {
      operations: [{ update: { resourceName, status: 'ENABLED' }, updateMask: 'status' }],
    }, loginCustomerId);
    return { resumed: true };
  }

  throw resumeError('Unsupported managed advertising provider.', 'paid_ads_provider_invalid');
}
