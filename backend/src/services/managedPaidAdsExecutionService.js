import { getTokens } from './appConnector.js';
import { majorToMinor, minorToMicros } from './currencyService.js';

const META_BASE = 'https://graph.facebook.com/v26.0';
const GOOGLE_BASE = 'https://googleads.googleapis.com/v26';

function executionError(message, code, statusCode = 409, extra = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

function requiredDate(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw executionError(`${label} is required and must be a valid date/time.`, 'paid_ads_schedule_required');
  }
  return date;
}

function assertSchedule(startValue, endValue) {
  const start = requiredDate(startValue, 'Campaign start');
  const end = requiredDate(endValue, 'Campaign end');
  if (end <= start) throw executionError('Campaign end must be after campaign start.', 'paid_ads_schedule_invalid');
  return { start, end };
}

function requireHttps(value, label) {
  let url;
  try { url = new URL(String(value || '')); } catch { throw executionError(`${label} must be a valid HTTPS URL.`, 'paid_ads_creative_invalid'); }
  if (url.protocol !== 'https:') throw executionError(`${label} must use HTTPS.`, 'paid_ads_creative_invalid');
  return url.toString();
}

async function tokenFor(userId, connectorId) {
  const tokens = await getTokens(userId, connectorId);
  if (!tokens?.accessToken) throw executionError('Advertising provider is not connected.', 'paid_ads_provider_not_connected');
  return tokens.accessToken;
}

async function jsonRequest(url, options, code) {
  let response;
  try { response = await fetch(url, options); } catch { throw executionError('Advertising provider could not be reached.', code, 502); }
  let body = null;
  try { body = await response.json(); } catch { /* upstream can return empty bodies */ }
  if (!response.ok) {
    const detail = body?.error?.message || body?.message || `HTTP ${response.status}`;
    throw executionError(`Advertising provider rejected the request: ${detail}`, code, 502, { providerStatus: response.status });
  }
  return body ?? {};
}

async function metaPost(path, token, values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    body.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return jsonRequest(`${META_BASE}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }, 'meta_ads_execution_failed');
}

export function validateManagedPaidAdLaunch(budget) {
  if (!budget?.providerAccountId || !budget?.providerAccount?.currency || !budget?.campaignConfig) {
    throw executionError('A verified advertising account, account currency, and campaign configuration are required.', 'paid_ads_campaign_configuration_required');
  }
  if (!Number.isInteger(Number(budget.mediaSpendCapCents)) || Number(budget.mediaSpendCapCents) <= 0) {
    throw executionError('A positive provider media-spend cap is required.', 'paid_ads_media_cap_required');
  }

  const config = budget.campaignConfig;
  if (budget.provider === 'meta') {
    const { start, end } = assertSchedule(config.startTime, config.endTime);
    requireHttps(config.destinationUrl, 'Campaign destination');
    requireHttps(config.imageUrl, 'Meta creative image');
    if (config.specialAdCategoriesDeclared !== true || !Array.isArray(config.specialAdCategories)) {
      throw executionError('Meta special-ad-category status must be explicitly declared.', 'paid_ads_meta_special_category_declaration_required');
    }
    return { provider: 'meta', start, end };
  }

  if (budget.provider === 'google') {
    const { start, end } = assertSchedule(config.startDate, config.endDate);
    requireHttps(config.destinationUrl, 'Campaign destination');
    if (!['CONTAINS_EU_POLITICAL_ADVERTISING', 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'].includes(config.euPoliticalAdvertising)) {
      throw executionError('Google EU political-advertising status must be explicitly declared.', 'paid_ads_google_political_declaration_required');
    }
    if (!/^[A-Z]{2}$/.test(String(config.countryCode || ''))) {
      throw executionError('Google Search campaign requires a valid two-letter target country code.', 'paid_ads_google_country_required');
    }
    return { provider: 'google', start, end };
  }

  throw executionError('Unsupported managed advertising provider.', 'paid_ads_provider_invalid');
}

async function launchMeta(userId, budget) {
  const config = budget.campaignConfig;
  const { start, end } = validateManagedPaidAdLaunch(budget);
  const token = await tokenFor(userId, 'meta_ads');
  const account = String(budget.providerAccountId).startsWith('act_') ? String(budget.providerAccountId) : `act_${budget.providerAccountId}`;
  const created = { campaignId: null, adSetId: null, creativeId: null, adId: null };

  try {
    const campaign = await metaPost(`${account}/campaigns`, token, {
      name: config.name,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: config.specialAdCategories,
    });
    created.campaignId = campaign.id;
    if (!created.campaignId) throw executionError('Meta did not return a campaign id.', 'meta_ads_execution_failed', 502);

    const adSet = await metaPost(`${account}/adsets`, token, {
      name: `${config.name} — Ad Set`,
      campaign_id: created.campaignId,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      lifetime_budget: Number(budget.mediaSpendCapCents),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      targeting: { geo_locations: { countries: config.countries } },
      status: 'PAUSED',
    });
    created.adSetId = adSet.id;
    if (!created.adSetId) throw executionError('Meta did not return an ad set id.', 'meta_ads_execution_failed', 502);

    const linkData = {
      link: config.destinationUrl,
      message: config.primaryText,
      name: config.headline,
      picture: config.imageUrl,
      call_to_action: { type: config.callToAction || 'LEARN_MORE', value: { link: config.destinationUrl } },
    };
    if (config.description) linkData.description = config.description;
    const storySpec = { page_id: config.pageId, link_data: linkData };
    if (config.instagramActorId) storySpec.instagram_user_id = config.instagramActorId;

    const creative = await metaPost(`${account}/adcreatives`, token, {
      name: `${config.name} — Creative`,
      object_story_spec: storySpec,
    });
    created.creativeId = creative.id;
    if (!created.creativeId) throw executionError('Meta did not return a creative id.', 'meta_ads_execution_failed', 502);

    const ad = await metaPost(`${account}/ads`, token, {
      name: `${config.name} — Ad`,
      adset_id: created.adSetId,
      creative: { creative_id: created.creativeId },
      status: 'PAUSED',
    });
    created.adId = ad.id;
    if (!created.adId) throw executionError('Meta did not return an ad id.', 'meta_ads_execution_failed', 502);

    await metaPost(created.adId, token, { status: 'ACTIVE' });
    await metaPost(created.adSetId, token, { status: 'ACTIVE' });
    await metaPost(created.campaignId, token, { status: 'ACTIVE' });
    return { ...created, provider: 'meta', status: 'active' };
  } catch (error) {
    if (created.campaignId) {
      try { await metaPost(created.campaignId, token, { status: 'PAUSED' }); } catch { /* partial ids retained */ }
    }
    error.providerResources = created;
    throw error;
  }
}

function googleHeaders(token, loginCustomerId = null) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (loginCustomerId) headers['login-customer-id'] = String(loginCustomerId).replace(/\D/g, '');
  return headers;
}

async function googlePost(path, token, body, code = 'google_ads_execution_failed', loginCustomerId = null) {
  return jsonRequest(`${GOOGLE_BASE}/${path}`, {
    method: 'POST',
    headers: googleHeaders(token, loginCustomerId),
    body: JSON.stringify(body),
  }, code);
}

function googleCampaignDateTime(dateText, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ''))) {
    throw executionError('Google campaign date must use YYYY-MM-DD format.', 'paid_ads_schedule_invalid');
  }
  return `${dateText} ${endOfDay ? '23:59:59' : '00:00:00'}`;
}

async function googleLookupGeoTarget(customerId, token, config, loginCustomerId = null) {
  const escapedCountry = String(config.countryCode).replace(/'/g, "\\'");
  const statement = `SELECT geo_target_constant.resource_name, geo_target_constant.name FROM geo_target_constant WHERE geo_target_constant.country_code = '${escapedCountry}' AND geo_target_constant.target_type = 'Country' AND geo_target_constant.status = 'ENABLED' LIMIT 1`;
  const body = await googlePost(
    `customers/${customerId}/googleAds:searchStream`,
    token,
    { query: statement },
    'google_ads_targeting_lookup_failed',
    loginCustomerId,
  );
  const batches = Array.isArray(body) ? body : [body];
  const result = batches.flatMap((batch) => Array.isArray(batch?.results) ? batch.results : [])[0] || null;
  const geo = result?.geoTargetConstant?.resourceName;
  if (!geo) throw executionError('Google Ads could not resolve the requested country targeting.', 'google_ads_targeting_lookup_failed', 409);
  return geo;
}

async function googleRemove(customerId, token, service, resourceName, loginCustomerId = null) {
  if (!resourceName) return;
  try {
    await googlePost(`customers/${customerId}/${service}:mutate`, token, { operations: [{ remove: resourceName }] }, 'google_ads_cleanup_failed', loginCustomerId);
  } catch { /* launch error carries resource ids for remediation */ }
}

async function launchGoogle(userId, budget) {
  const config = budget.campaignConfig;
  validateManagedPaidAdLaunch(budget);
  const token = await tokenFor(userId, 'google_ads');
  const customerId = String(budget.providerAccountId).replace(/\D/g, '');
  const loginCustomerId = budget.providerAccount?.loginCustomerId || null;
  if (!/^\d{10}$/.test(customerId)) throw executionError('Google Ads customer id must contain 10 digits.', 'google_ads_customer_invalid');
  const created = { budgetResourceName: null, campaignResourceName: null, adGroupResourceName: null, adResourceName: null };

  try {
    const geoTarget = await googleLookupGeoTarget(customerId, token, config, loginCustomerId);
    const budgetResponse = await googlePost(`customers/${customerId}/campaignBudgets:mutate`, token, {
      operations: [{ create: {
        name: `${config.name} — TrillionAI Budget ${Date.now()}`,
        period: 'CUSTOM_PERIOD',
        totalAmountMicros: String(minorToMicros(Number(budget.mediaSpendCapCents), budget.providerAccount.currency)),
        explicitlyShared: false,
        deliveryMethod: 'STANDARD',
      } }],
    }, 'google_ads_execution_failed', loginCustomerId);
    created.budgetResourceName = budgetResponse?.results?.[0]?.resourceName;
    if (!created.budgetResourceName) throw executionError('Google Ads did not return a campaign budget resource.', 'google_ads_execution_failed', 502);

    const campaignResponse = await googlePost(`customers/${customerId}/campaigns:mutate`, token, {
      operations: [{ create: {
        name: config.name,
        advertisingChannelType: 'SEARCH',
        status: 'PAUSED',
        campaignBudget: created.budgetResourceName,
        targetSpend: {},
        containsEuPoliticalAdvertising: config.euPoliticalAdvertising,
        networkSettings: {
          targetGoogleSearch: true,
          targetSearchNetwork: true,
          targetContentNetwork: false,
          targetPartnerSearchNetwork: false,
        },
        startDateTime: googleCampaignDateTime(config.startDate, false),
        endDateTime: googleCampaignDateTime(config.endDate, true),
      } }],
    }, 'google_ads_execution_failed', loginCustomerId);
    created.campaignResourceName = campaignResponse?.results?.[0]?.resourceName;
    if (!created.campaignResourceName) throw executionError('Google Ads did not return a campaign resource.', 'google_ads_execution_failed', 502);

    await googlePost(`customers/${customerId}/campaignCriteria:mutate`, token, {
      operations: [
        { create: { campaign: created.campaignResourceName, location: { geoTargetConstant: geoTarget } } },
      ],
    }, 'google_ads_execution_failed', loginCustomerId);

    const adGroupResponse = await googlePost(`customers/${customerId}/adGroups:mutate`, token, {
      operations: [{ create: {
        name: `${config.name} — Ad Group`,
        campaign: created.campaignResourceName,
        status: 'PAUSED',
        type: 'SEARCH_STANDARD',
      } }],
    }, 'google_ads_execution_failed', loginCustomerId);
    created.adGroupResourceName = adGroupResponse?.results?.[0]?.resourceName;
    if (!created.adGroupResourceName) throw executionError('Google Ads did not return an ad group resource.', 'google_ads_execution_failed', 502);

    await googlePost(`customers/${customerId}/adGroupCriteria:mutate`, token, {
      operations: config.keywords.map((keyword) => ({ create: {
        adGroup: created.adGroupResourceName,
        status: 'ENABLED',
        keyword: { text: keyword, matchType: 'PHRASE' },
      } })),
    }, 'google_ads_execution_failed', loginCustomerId);

    const adResponse = await googlePost(`customers/${customerId}/adGroupAds:mutate`, token, {
      operations: [{ create: {
        adGroup: created.adGroupResourceName,
        status: 'PAUSED',
        ad: {
          finalUrls: [config.destinationUrl],
          responsiveSearchAd: {
            headlines: config.headlines.map((text) => ({ text })),
            descriptions: config.descriptions.map((text) => ({ text })),
          },
        },
      } }],
    }, 'google_ads_execution_failed', loginCustomerId);
    created.adResourceName = adResponse?.results?.[0]?.resourceName;
    if (!created.adResourceName) throw executionError('Google Ads did not return an ad resource.', 'google_ads_execution_failed', 502);

    await googlePost(`customers/${customerId}/adGroupAds:mutate`, token, {
      operations: [{ update: { resourceName: created.adResourceName, status: 'ENABLED' }, updateMask: 'status' }],
    }, 'google_ads_execution_failed', loginCustomerId);
    await googlePost(`customers/${customerId}/adGroups:mutate`, token, {
      operations: [{ update: { resourceName: created.adGroupResourceName, status: 'ENABLED' }, updateMask: 'status' }],
    }, 'google_ads_execution_failed', loginCustomerId);
    await googlePost(`customers/${customerId}/campaigns:mutate`, token, {
      operations: [{ update: { resourceName: created.campaignResourceName, status: 'ENABLED' }, updateMask: 'status' }],
    }, 'google_ads_execution_failed', loginCustomerId);

    return {
      provider: 'google',
      campaignId: created.campaignResourceName.split('/').pop(),
      campaignResourceName: created.campaignResourceName,
      budgetResourceName: created.budgetResourceName,
      adGroupResourceName: created.adGroupResourceName,
      adResourceName: created.adResourceName,
      status: 'active',
    };
  } catch (error) {
    if (created.campaignResourceName) {
      try {
        await googlePost(`customers/${customerId}/campaigns:mutate`, token, {
          operations: [{ update: { resourceName: created.campaignResourceName, status: 'PAUSED' }, updateMask: 'status' }],
        }, 'google_ads_cleanup_failed', loginCustomerId);
      } catch { /* partial ids retained */ }
    }
    if (!created.campaignResourceName && created.budgetResourceName) {
      await googleRemove(customerId, token, 'campaignBudgets', created.budgetResourceName, loginCustomerId);
    }
    error.providerResources = created;
    throw error;
  }
}

export async function launchManagedPaidAdCampaign(userId, budget) {
  validateManagedPaidAdLaunch(budget);
  if (budget.provider === 'meta') return launchMeta(userId, budget);
  if (budget.provider === 'google') return launchGoogle(userId, budget);
  throw executionError('Unsupported managed advertising provider.', 'paid_ads_provider_invalid');
}

export async function pauseManagedPaidAdCampaign(userId, budget) {
  if (!budget?.providerCampaignId) return { paused: true, alreadyAbsent: true };
  if (budget.provider === 'meta') {
    const token = await tokenFor(userId, 'meta_ads');
    await metaPost(budget.providerCampaignId, token, { status: 'PAUSED' });
    return { paused: true };
  }
  if (budget.provider === 'google') {
    const token = await tokenFor(userId, 'google_ads');
    const customerId = String(budget.providerAccountId).replace(/\D/g, '');
    const loginCustomerId = budget.providerAccount?.loginCustomerId || null;
    const resourceName = budget.providerCampaignResourceName || `customers/${customerId}/campaigns/${budget.providerCampaignId}`;
    await googlePost(`customers/${customerId}/campaigns:mutate`, token, {
      operations: [{ update: { resourceName, status: 'PAUSED' }, updateMask: 'status' }],
    }, 'google_ads_pause_failed', loginCustomerId);
    return { paused: true };
  }
  throw executionError('Unsupported managed advertising provider.', 'paid_ads_provider_invalid');
}

export async function readManagedPaidAdSpend(userId, budget) {
  if (!budget?.providerCampaignId) return { spendMinor: 0 };
  const currency = budget.providerAccount?.currency;
  if (!currency) throw executionError('Provider account currency is required for spend reconciliation.', 'paid_ads_provider_currency_required');

  if (budget.provider === 'meta') {
    const token = await tokenFor(userId, 'meta_ads');
    const url = new URL(`${META_BASE}/${budget.providerCampaignId}/insights`);
    url.searchParams.set('fields', 'spend');
    url.searchParams.set('date_preset', 'maximum');
    const body = await jsonRequest(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, 'meta_ads_spend_read_failed');
    const spend = Number(body?.data?.[0]?.spend || 0);
    return { spendMinor: majorToMinor(spend, currency), currency };
  }

  if (budget.provider === 'google') {
    const token = await tokenFor(userId, 'google_ads');
    const customerId = String(budget.providerAccountId).replace(/\D/g, '');
    const loginCustomerId = budget.providerAccount?.loginCustomerId || null;
    const campaignId = String(budget.providerCampaignId).replace(/\D/g, '');
    const body = await googlePost(`customers/${customerId}/googleAds:searchStream`, token, {
      query: `SELECT metrics.cost_micros FROM campaign WHERE campaign.id = ${campaignId}`,
    }, 'google_ads_spend_read_failed', loginCustomerId);
    const batches = Array.isArray(body) ? body : [body];
    const micros = batches.flatMap((batch) => Array.isArray(batch?.results) ? batch.results : [])
      .reduce((sum, row) => sum + Number(row?.metrics?.costMicros || 0), 0);
    const major = micros / 1_000_000;
    return { spendMinor: majorToMinor(major, currency), currency };
  }

  throw executionError('Unsupported managed advertising provider.', 'paid_ads_provider_invalid');
}

export default {
  launchManagedPaidAdCampaign,
  pauseManagedPaidAdCampaign,
  readManagedPaidAdSpend,
  validateManagedPaidAdLaunch,
};
