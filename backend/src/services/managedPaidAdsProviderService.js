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

function googleHeaders(accessToken, loginCustomerId = null) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  if (loginCustomerId) headers['login-customer-id'] = String(loginCustomerId).replace(/\D/g, '');
  return headers;
}

async function googleSearch(config, tokens, customerId, query, failureCode, loginCustomerId = null) {
  const body = await providerJson(`${config.baseUrl}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: googleHeaders(tokens.accessToken, loginCustomerId),
    body: JSON.stringify({ query }),
  }, failureCode);
  const batches = Array.isArray(body) ? body : [body];
  return batches.flatMap((batch) => Array.isArray(batch?.results) ? batch.results : []);
}

async function googleCustomerDetail(config, tokens, customerId, resourceName, loginCustomerId = null) {
  const rows = await googleSearch(
    config,
    tokens,
    customerId,
    'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.status, customer.manager FROM customer LIMIT 1',
    'google_ads_account_detail_failed',
    loginCustomerId,
  );
  const customer = rows[0]?.customer || {};
  return {
    id: customerId,
    providerAccountId: customerId,
    accountId: customerId,
    name: String(customer.descriptiveName || `Google Ads ${customerId}`),
    resourceName: customer.resourceName || resourceName,
    currency: String(customer.currencyCode || '').toUpperCase() || null,
    timezone: customer.timeZone || null,
    status: customer.status || 'accessible',
    manager: customer.manager === true,
    loginCustomerId: loginCustomerId || null,
  };
}

async function googleManagerClients(config, tokens, managerCustomerId) {
  const query = [
    'SELECT customer_client.client_customer, customer_client.id, customer_client.level,',
    'customer_client.manager, customer_client.descriptive_name, customer_client.currency_code,',
    'customer_client.time_zone, customer_client.status, customer_client.hidden',
    'FROM customer_client',
    "WHERE customer_client.status = 'ENABLED'",
  ].join(' ');
  const rows = await googleSearch(
    config,
    tokens,
    managerCustomerId,
    query,
    'google_ads_account_hierarchy_failed',
    managerCustomerId,
  );

  return rows
    .map((row) => row.customerClient || {})
    .filter((client) => client.manager !== true && client.hidden !== true && Number(client.level) > 0)
    .map((client) => {
      const customerId = String(client.id || String(client.clientCustomer || '').replace(/^customers\//, '')).replace(/\D/g, '');
      return {
        id: customerId,
        providerAccountId: customerId,
        accountId: customerId,
        name: String(client.descriptiveName || `Google Ads ${customerId}`),
        resourceName: client.clientCustomer || `customers/${customerId}`,
        currency: String(client.currencyCode || '').toUpperCase() || null,
        timezone: client.timeZone || null,
        status: client.status || 'ENABLED',
        manager: false,
        loginCustomerId: managerCustomerId,
      };
    })
    .filter((account) => /^\d{10}$/.test(account.providerAccountId) && account.currency);
}

async function listGoogleAdAccounts(userId) {
  const { config, tokens } = await requireAccessToken(userId, 'google');
  const body = await providerJson(`${config.baseUrl}/customers:listAccessibleCustomers`, {
    method: 'GET',
    headers: googleHeaders(tokens.accessToken),
  }, 'google_ads_account_discovery_failed');

  const resourceNames = Array.isArray(body.resourceNames) ? body.resourceNames.slice(0, 100) : [];
  const accounts = [];
  for (const resourceName of resourceNames) {
    const customerId = String(resourceName).replace(/^customers\//, '').replace(/-/g, '');
    if (!/^\d{10}$/.test(customerId)) continue;
    try {
      const root = await googleCustomerDetail(config, tokens, customerId, resourceName);
      if (root.manager) {
        accounts.push(...await googleManagerClients(config, tokens, customerId));
      } else if (root.currency) {
        accounts.push(root);
      }
    } catch (error) {
      if (['google_ads_account_detail_failed', 'google_ads_account_hierarchy_failed'].includes(error.code)) continue;
      throw error;
    }
  }

  const unique = new Map();
  for (const account of accounts) {
    const existing = unique.get(account.providerAccountId);
    // Prefer a direct-access representation over manager-mediated access where both exist.
    if (!existing || (existing.loginCustomerId && !account.loginCustomerId)) unique.set(account.providerAccountId, account);
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listManagedPaidAdAccounts(userId, provider) {
  const id = normalizeProvider(provider);
  return id === 'meta' ? listMetaAdAccounts(userId) : listGoogleAdAccounts(userId);
}

export async function requireManagedPaidAdAccount(userId, provider, providerAccountId) {
  const wanted = String(providerAccountId || '').trim().replace(/-/g, '');
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
