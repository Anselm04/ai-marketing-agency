import { aiModelRegistry } from './aiModelRegistry.js';

const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

export function parseAnthropicSseFrame(frame) {
  const lines = String(frame || '').split(/\r?\n/);
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());
  if (!dataLines.length) return null;
  const payload = dataLines.join('\n');
  if (!payload || payload === '[DONE]') return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function* streamAnthropicMessages(messages, options = {}) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('Anthropic streaming is unavailable because ANTHROPIC_API_KEY is not configured.');
    error.code = 'anthropic_not_configured';
    error.statusCode = 503;
    throw error;
  }

  const model = options.model || 'claude-3-5-sonnet-20241022';
  const system = messages.find((message) => message.role === 'system')?.content || undefined;
  const conversationalMessages = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': process.env.ANTHROPIC_API_VERSION || DEFAULT_ANTHROPIC_VERSION,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      system,
      messages: conversationalMessages,
      stream: true,
    }),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message || body?.message || '';
    } catch {
      // Avoid echoing provider response bodies when they are not valid JSON.
    }
    const error = new Error(detail || `Anthropic streaming request failed with HTTP ${response.status}.`);
    error.code = 'anthropic_stream_failed';
    error.statusCode = response.status || 502;
    throw error;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary = buffer.search(/\r?\n\r?\n/);
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      const delimiter = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] || '\n\n';
      buffer = buffer.slice(boundary + delimiter.length);
      const event = parseAnthropicSseFrame(frame);
      if (event?.type === 'error') {
        const error = new Error(event.error?.message || 'Anthropic stream returned an error event.');
        error.code = 'anthropic_stream_failed';
        error.statusCode = 502;
        throw error;
      }
      if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
        yield {
          choices: [{ delta: { content: event.delta.text } }],
          provider: 'anthropic',
          model,
          eventType: event.type,
        };
      }
      boundary = buffer.search(/\r?\n\r?\n/);
    }
  }

  buffer += decoder.decode();
  const finalEvent = parseAnthropicSseFrame(buffer);
  if (finalEvent?.type === 'content_block_delta' && finalEvent.delta?.type === 'text_delta' && finalEvent.delta.text) {
    yield {
      choices: [{ delta: { content: finalEvent.delta.text } }],
      provider: 'anthropic',
      model,
      eventType: finalEvent.type,
    };
  }
}

export function installAnthropicStreaming() {
  const provider = aiModelRegistry.getProvider('anthropic');
  if (!provider) return false;
  provider.streamChatCompletion = (messages, options = {}) => streamAnthropicMessages(messages, options);
  return true;
}

export default { installAnthropicStreaming, parseAnthropicSseFrame, streamAnthropicMessages };
