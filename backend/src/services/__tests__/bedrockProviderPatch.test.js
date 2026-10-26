import { describe, expect, test } from '@jest/globals';
import {
  buildBedrockPayload,
  parseBedrockResponse,
  signBedrockRequest,
} from '../bedrockProviderPatch.js';

describe('AWS Bedrock provider adapter', () => {
  test('builds Anthropic Messages payloads for Bedrock', () => {
    const payload = buildBedrockPayload(
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hello' },
      ],
      { maxTokens: 512, temperature: 0.2 },
    );

    expect(payload.anthropic_version).toBe('bedrock-2023-05-31');
    expect(payload.system).toBe('Be concise.');
    expect(payload.messages[0]).toEqual({
      role: 'user',
      content: [{ type: 'text', text: 'Hello' }],
    });
  });

  test('builds Llama native InvokeModel payloads', () => {
    const payload = buildBedrockPayload(
      'meta.llama3-1-70b-instruct-v1:0',
      [{ role: 'user', content: 'Explain this.' }],
      { maxTokens: 1000 },
    );

    expect(payload.prompt).toMatch(/<\|begin_of_text\|>/);
    expect(payload.prompt).toMatch(/Explain this/);
    expect(payload.max_gen_len).toBe(1000);
  });

  test('builds Titan Text payloads and parses provider response', () => {
    const payload = buildBedrockPayload(
      'amazon.titan-text-express-v1',
      [{ role: 'user', content: 'Write a headline.' }],
      { maxTokens: 300 },
    );
    expect(payload.inputText).toMatch(/Write a headline/);
    expect(payload.textGenerationConfig.maxTokenCount).toBe(300);

    const parsed = parseBedrockResponse('amazon.titan-text-express-v1', {
      inputTextTokenCount: 5,
      results: [{ outputText: 'Headline', tokenCount: 2, completionReason: 'FINISH' }],
    });
    expect(parsed.content).toBe('Headline');
    expect(parsed.usage.total_tokens).toBe(7);
  });

  test('creates a deterministic SigV4 authorization header for a fixed timestamp', () => {
    const body = JSON.stringify({ inputText: 'Hello' });
    const signed = signBedrockRequest({
      region: 'us-east-1',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'secret-example',
      model: 'amazon.titan-text-express-v1',
      body,
      now: new Date('2026-10-26T00:00:00.000Z'),
    });

    expect(signed.url).toMatch(/^https:\/\/bedrock-runtime\.us-east-1\.amazonaws\.com\/model\//);
    expect(signed.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20261026\/us-east-1\/bedrock\/aws4_request/);
    expect(signed.headers['X-Amz-Date']).toBe('20261026T000000Z');
    expect(signed.headers['X-Amz-Content-Sha256']).toMatch(/^[a-f0-9]{64}$/);
  });

  test('rejects Bedrock models without a verified native adapter', () => {
    expect(() => buildBedrockPayload('unknown.provider-model', [{ role: 'user', content: 'Hi' }]))
      .toThrow(/does not have a verified native InvokeModel payload adapter/i);
  });
});
