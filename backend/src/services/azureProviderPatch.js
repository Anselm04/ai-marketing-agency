import { aiModelRegistry } from './aiModelRegistry.js';

function configuration() {
  return {
    apiKey: String(process.env.AZURE_OPENAI_API_KEY || '').trim(),
    endpoint: String(process.env.AZURE_OPENAI_ENDPOINT || '').trim().replace(/\/$/, ''),
    apiVersion: String(process.env.AZURE_OPENAI_API_VERSION || '2024-06-01').trim(),
  };
}

function configurationError(message, code = 'azure_openai_not_configured', statusCode = 503) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export function installAzureOpenAIProviderPatch() {
  const provider = aiModelRegistry.getProvider('azure');
  if (!provider) return false;

  const configured = () => {
    const { apiKey, endpoint } = configuration();
    return Boolean(apiKey && /^https:\/\//i.test(endpoint));
  };

  provider.available = configured();
  provider.isAvailable = () => configured();

  provider.generateChatCompletion = async (messages, options = {}) => {
    const { apiKey, endpoint, apiVersion } = configuration();
    if (!apiKey || !endpoint) {
      throw configurationError('Azure OpenAI requires both AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT.');
    }
    if (!/^https:\/\//i.test(endpoint)) {
      throw configurationError('AZURE_OPENAI_ENDPOINT must be a valid HTTPS endpoint.', 'azure_openai_endpoint_invalid', 409);
    }

    const deployment = String(options.deployment || options.model || '').trim();
    if (!deployment) {
      throw configurationError('Azure OpenAI requires a deployment name/model id.', 'azure_openai_deployment_required', 400);
    }

    const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        top_p: options.topP ?? 1,
        stream: false,
      }),
      signal: options.signal,
    });

    let body = null;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) {
      const detail = body?.error?.message || body?.message || `HTTP ${response.status}`;
      const error = new Error(`Azure OpenAI rejected the request: ${detail}`);
      error.code = 'azure_openai_request_failed';
      error.statusCode = response.status === 401 || response.status === 403 ? 409 : 502;
      throw error;
    }

    const content = body?.choices?.[0]?.message?.content || '';
    if (!String(content).trim()) {
      const error = new Error('Azure OpenAI returned no text content.');
      error.code = 'azure_openai_empty_response';
      error.statusCode = 502;
      throw error;
    }

    return {
      content,
      usage: body.usage || {},
      model: body.model || deployment,
      provider: 'azure',
      finishReason: body?.choices?.[0]?.finish_reason || null,
    };
  };

  provider.generateCompletion = (prompt, options = {}) => provider.generateChatCompletion([{ role: 'user', content: prompt }], options);
  return true;
}

export default { installAzureOpenAIProviderPatch };
