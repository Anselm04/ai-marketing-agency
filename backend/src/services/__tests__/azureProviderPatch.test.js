import { afterEach, describe, expect, test } from '@jest/globals';
import { aiModelRegistry } from '../aiModelRegistry.js';
import { installAzureOpenAIProviderPatch } from '../azureProviderPatch.js';

const original = {
  key: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
};

afterEach(() => {
  if (original.key == null) delete process.env.AZURE_OPENAI_API_KEY;
  else process.env.AZURE_OPENAI_API_KEY = original.key;
  if (original.endpoint == null) delete process.env.AZURE_OPENAI_ENDPOINT;
  else process.env.AZURE_OPENAI_ENDPOINT = original.endpoint;
  installAzureOpenAIProviderPatch();
});

describe('Azure OpenAI provider configuration', () => {
  test('does not advertise Azure as available when endpoint is missing', () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key';
    delete process.env.AZURE_OPENAI_ENDPOINT;
    installAzureOpenAIProviderPatch();
    expect(aiModelRegistry.getProvider('azure').isAvailable()).toBe(false);
  });

  test('requires an HTTPS Azure endpoint', () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key';
    process.env.AZURE_OPENAI_ENDPOINT = 'http://example.invalid';
    installAzureOpenAIProviderPatch();
    expect(aiModelRegistry.getProvider('azure').isAvailable()).toBe(false);
  });

  test('reports complete key plus HTTPS endpoint configuration as available', () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example-resource.openai.azure.com';
    installAzureOpenAIProviderPatch();
    expect(aiModelRegistry.getProvider('azure').isAvailable()).toBe(true);
  });
});
