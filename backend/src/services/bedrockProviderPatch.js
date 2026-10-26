import crypto from 'crypto';
import { aiModelRegistry } from './aiModelRegistry.js';

const SERVICE = 'bedrock';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding = undefined) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function awsTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function canonicalPath(model) {
  return `/model/${encodeURIComponent(String(model)).replace(/%3A/gi, '%3A')}/invoke`;
}

export function signBedrockRequest({ region, accessKeyId, secretAccessKey, sessionToken = null, model, body, now = new Date() }) {
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const amzDate = awsTimestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const path = canonicalPath(model);

  const headers = {
    'content-type': 'application/json',
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (sessionToken) headers['x-amz-security-token'] = sessionToken;

  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${String(headers[name]).trim()}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');

  const kDate = hmac(Buffer.from(`AWS4${secretAccessKey}`, 'utf8'), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign, 'hex');

  return {
    url: `https://${host}${path}`,
    headers: {
      'Content-Type': 'application/json',
      Host: host,
      'X-Amz-Content-Sha256': payloadHash,
      'X-Amz-Date': amzDate,
      ...(sessionToken ? { 'X-Amz-Security-Token': sessionToken } : {}),
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

function textOf(message) {
  if (typeof message?.content === 'string') return message.content;
  if (Array.isArray(message?.content)) {
    return message.content.map((part) => typeof part === 'string' ? part : part?.text || '').filter(Boolean).join('\n');
  }
  return String(message?.content || '');
}

function llamaPrompt(messages = []) {
  const turns = messages
    .filter((message) => ['system', 'user', 'assistant'].includes(message?.role))
    .map((message) => `<|start_header_id|>${message.role}<|end_header_id|>\n${textOf(message)}<|eot_id|>`)
    .join('\n');
  return `<|begin_of_text|>${turns}\n<|start_header_id|>assistant<|end_header_id|>\n`;
}

export function buildBedrockPayload(model, messages = [], options = {}) {
  const id = String(model || '');
  const maxTokens = Number(options.maxTokens || 4096);
  const temperature = Number(options.temperature ?? 0.7);

  if (id.startsWith('anthropic.')) {
    const system = messages.filter((message) => message.role === 'system').map(textOf).filter(Boolean).join('\n\n');
    return {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages: messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: [{ type: 'text', text: textOf(message) }],
        })),
    };
  }

  if (id.startsWith('meta.llama')) {
    return {
      prompt: llamaPrompt(messages),
      max_gen_len: Math.min(Math.max(maxTokens, 1), 2048),
      temperature: Math.min(Math.max(temperature, 0), 1),
      top_p: Math.min(Math.max(Number(options.topP ?? 0.9), 0), 1),
    };
  }

  if (id.startsWith('amazon.titan-text')) {
    const inputText = messages.map((message) => `${message.role || 'user'}: ${textOf(message)}`).join('\n');
    return {
      inputText,
      textGenerationConfig: {
        maxTokenCount: maxTokens,
        temperature: Math.min(Math.max(temperature, 0), 1),
        topP: Math.min(Math.max(Number(options.topP ?? 1), 0), 1),
        stopSequences: Array.isArray(options.stopSequences) ? options.stopSequences.slice(0, 4) : [],
      },
    };
  }

  const error = new Error(`Bedrock model ${id} does not have a verified native InvokeModel payload adapter.`);
  error.code = 'bedrock_model_adapter_unavailable';
  error.statusCode = 409;
  throw error;
}

export function parseBedrockResponse(model, body = {}) {
  const id = String(model || '');
  if (id.startsWith('anthropic.')) {
    return {
      content: Array.isArray(body.content) ? body.content.filter((part) => part?.type === 'text').map((part) => part.text).join('') : '',
      usage: body.usage || {},
      finishReason: body.stop_reason || null,
    };
  }
  if (id.startsWith('meta.llama')) {
    return {
      content: body.generation || '',
      usage: {
        prompt_tokens: Number(body.prompt_token_count || 0),
        completion_tokens: Number(body.generation_token_count || 0),
        total_tokens: Number(body.prompt_token_count || 0) + Number(body.generation_token_count || 0),
      },
      finishReason: body.stop_reason || null,
    };
  }
  if (id.startsWith('amazon.titan-text')) {
    const result = Array.isArray(body.results) ? body.results[0] : null;
    return {
      content: result?.outputText || '',
      usage: {
        prompt_tokens: Number(body.inputTextTokenCount || 0),
        completion_tokens: Number(result?.tokenCount || 0),
        total_tokens: Number(body.inputTextTokenCount || 0) + Number(result?.tokenCount || 0),
      },
      finishReason: result?.completionReason || null,
    };
  }
  return { content: '', usage: {}, finishReason: null };
}

export function installBedrockProviderPatch() {
  const provider = aiModelRegistry.getProvider('bedrock');
  if (!provider) return false;

  const accessKeyId = String(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_BEDROCK_ACCESS_KEY || '').trim();
  const secretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_BEDROCK_SECRET_KEY || '').trim();
  const sessionToken = String(process.env.AWS_SESSION_TOKEN || '').trim() || null;
  const region = String(process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1').trim();
  const configured = Boolean(accessKeyId && secretAccessKey && region);

  provider.available = configured;
  provider.isAvailable = () => configured;

  provider.generateChatCompletion = async (messages, options = {}) => {
    if (!configured) {
      const error = new Error('AWS Bedrock is unavailable until valid access-key and secret-key credentials are configured.');
      error.code = 'bedrock_not_configured';
      error.statusCode = 503;
      throw error;
    }

    const model = options.model || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    const payload = buildBedrockPayload(model, messages, options);
    const body = JSON.stringify(payload);
    const signed = signBedrockRequest({ region, accessKeyId, secretAccessKey, sessionToken, model, body });
    const response = await fetch(signed.url, { method: 'POST', headers: signed.headers, body, signal: options.signal });

    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) {
      const detail = data?.message || data?.Message || data?.error?.message || `HTTP ${response.status}`;
      const error = new Error(`AWS Bedrock rejected the request: ${detail}`);
      error.code = 'bedrock_invoke_failed';
      error.statusCode = response.status === 401 || response.status === 403 ? 409 : 502;
      throw error;
    }

    const parsed = parseBedrockResponse(model, data || {});
    if (!String(parsed.content || '').trim()) {
      const error = new Error('AWS Bedrock returned no text content.');
      error.code = 'bedrock_empty_response';
      error.statusCode = 502;
      throw error;
    }
    return { ...parsed, model, provider: 'bedrock' };
  };

  provider.generateCompletion = (prompt, options = {}) => provider.generateChatCompletion([{ role: 'user', content: prompt }], options);
  return true;
}

export default { buildBedrockPayload, installBedrockProviderPatch, parseBedrockResponse, signBedrockRequest };
