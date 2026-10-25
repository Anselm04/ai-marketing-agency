import { getTokens } from './appConnector.js';

const PROVIDERS = Object.freeze({
  meta: {
    connectorId: 'meta_ads',
    apiVersion: 'v26.0',
    baseUrl: 'https://graph.facebook.com/v26.0',
  },
  google: {
    connectorId: 'google_ads',
    apiVersion: 'v26',
    baseUrl: 'https://googleads.googleapis.com/v26',
  },
});

function providerError(message, code, statusCode = 502) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normalizeProvider(provider) {
  const id = String(provider || '').trim().toLowerCase();
  if (!PROVIDERS[id]) throw providerError('Managed paid advertising provider must be Meta or Google.', 'paid_ads_provider_invalid', 400);
  return id;
}

async function requireAccessToken(userId, provider) {
  const id = normalizeProvider(provider);
  const config = PROVIDERS[id];
  const tokens = await getTokens(userId, config.connectorId);
  if (!tokens?.accessToken) {
    throw providerError(
      `Connect ${id === 'meta' ? 'Meta Ads' : 'Google Ads'} before selecting a managed advertising account.`,
      'paid_ads_provider_not_connected',
      409,
    );
  }
  return { id, config, tokens };
}

async function providerJson(url, options, failureCode) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw providerError('The advertising provider could not be reached.', failureCode, 502);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Do not expose arbitrary upstream response bodies.
  }

  if (!response.ok) {
    const upstreamMessage = body?.error?.message || body?.message;
    const error = providerError(
      upstreamMessage ? `Advertising provider rejected the request: ${upstreamMessage}` : `Advertising provider request failed with HTTP ${response.status}.`,
      failureCode,
      response.status === 401 || response.status === 403 ? 409 : 502,
    );
    error.providerStatus = response.status;
    throw error;
  }
  return body ?? {};
}

async function listMetaAdAccounts(userId) {
  const { config, tokens } = await requireAccessToken(userId, 'meta');
  const fields = 'id,name,account_id,account_status,currency,timezone_name,business';
  const url = new URL(`${config.baseUrl}/me/adaccounts`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('limit', '100');

  const body = await providerJson(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  }, 'meta_ads_account_discovery_failed');

  return (Array.isArray(body.data) ? body.data : []).map((account) => ({
    id: String(account.id || ''),
    providerAccountId: String(account.id || ''),
    accountId: String(account.account_id || '').trim() || null,
    name: String(account.name || account.id || 'Meta ad account'),
    currency: String(account.currency || '').toUpperCase() || null,
    timezone: account.timezone_name || null,
    status: account.account_status ?? null,
    businessId: account.business?.id || null,
    businessName: account.business?.name || null,
  })).filter((account) => account.providerAccountId && account.currency);
}

async function googleCustomerDetail(config, tokens, customerId, resourceName) {
  const url = `${config.baseUrl}/customers/${encodeURIComponent(customerId)}/googleAds:searchStream`;
  const body = await providerJson(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.status FROM customer LIMIT 1',
    }),
  }, 'google_ads_account_detail_failed');

  const batches = Array.isArray(body) ? body : [body];
  const result = batches.flatMap((batch) => Array.isArray(batch?.results) ? batch.results : [])[0];
  const customer = result?.customer || {};
  return {
    id: customerId,
    providerAccountId: customerId,
    accountId: customerId,
    name: String(customer.descriptiveName || `Google Ads ${customerId}`),
    resourceName: customer.resourceName || resourceName,
    currency: String(customer.currencyCode || '').toUpperCase() || null,
    timezone: customer.timeZone || null,
    status: customer.status || 'accessible',
  };
}

async function listGoogleAdAccounts(userId) {
  const { config, tokens } = await requireAccessToken(userId, 'google');
  const body = await providerJson(`${config.baseUrl}/customers:listAccessibleCustomers`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  }, 'google_ads_account_discovery_failed');

  const resourceNames = Array.isArray(body.resourceNames) ? body.resourceNames.slice(0, 100) : [];
  const accounts = [];
  for (const resourceName of resourceNames) {
    const customerId = String(resourceName).replace(/^customers\//, '').replace(/-/g, '');
    if (!/^\d{10}$/.test(customerId)) continue;
    try {
      const account = await googleCustomerDetail(config, tokens, customerId, resourceName);
      if (account.currency) accounts.push(account);
    } catch (error) {
      // An accessible manager/customer reference may still reject direct detail queries.
      // Omit it rather than presenting an unverified currency/account as launchable.
      if (error.code === 'google_ads_account_detail_failed') continue;
      throw error;
    }
  }
  return accounts;
}

export async function listManagedPaidAdAccounts(userId, provider) {
  const id = normalizeProvider(provider);
  return id === 'meta' ? listMetaAdAccounts(userId) : listGoogleAdAccounts(userId);
}

export async function requireManagedPaidAdAccount(userId, provider, providerAccountId) {
  const wanted = String(providerAccountId || '').trim();
  if (!wanted) {
    throw providerError('Select an advertising account.', 'paid_ads_provider_account_required', 400);
  }
  const accounts = await listManagedPaidAdAccounts(userId, provider);
  const account = accounts.find((item) => item.providerAccountId === wanted || item.accountId === wanted);
  if (!account) {
    throw providerError(
      'The selected advertising account is not accessible through the connected provider account.',
      'paid_ads_provider_account_not_accessible',
      409,
    );
  }
  if (!account.currency) {
    throw providerError(
      'The advertising provider did not return the account currency, so a strict spend cap cannot be enforced safely.',
      'paid_ads_provider_currency_required',
      409,
    );
  }
  return account;
}

export function managedPaidAdsProviderInfo(provider) {
  const id = normalizeProvider(provider);
  return { id, ...PROVIDERS[id] };
}

export { PROVIDERS as MANAGED_PAID_AD_PROVIDERS };
export default { listManagedPaidAdAccounts, requireManagedPaidAdAccount, managedPaidAdsProviderInfo };
