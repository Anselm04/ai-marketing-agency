import { afterEach, describe, expect, jest, test } from '@jest/globals';

const generate = jest.fn();
jest.unstable_mockModule('../services/openaiService.js', () => ({ generateAgentResponse: generate }));
const { default: translation } = await import('../services/translationService.js');
afterEach(() => generate.mockReset());

describe('translation output', () => {
  test('returns successful provider text rather than relabeling the original', async () => {
    generate.mockResolvedValue({ content: 'Hola mundo', fallback: false });
    await expect(translation.translate('Hello world', 'Spanish')).resolves.toMatchObject({ translated: 'Hola mundo', fallback: false });
  });
  test('preserves each language response for bulk translation', async () => {
    generate.mockResolvedValueOnce({ content: 'Hola', fallback: false }).mockResolvedValueOnce({ content: 'Bonjour', fallback: false });
    await expect(translation.translateToMultiple('Hello', ['Spanish', 'French'])).resolves.toEqual([
      expect.objectContaining({ translated: 'Hola', language: 'Spanish', fallback: false }),
      expect.objectContaining({ translated: 'Bonjour', language: 'French', fallback: false }),
    ]);
  });
  test('marks missing provider output as unavailable', async () => {
    generate.mockResolvedValue({ content: '', fallback: false });
    await expect(translation.translate('Hello', 'Spanish')).resolves.toMatchObject({ fallback: true });
  });
  test('does not call a provider when source and target match', async () => {
    await expect(translation.translate('Hello', 'English')).resolves.toMatchObject({ translated: 'Hello', auto: false });
    expect(generate).not.toHaveBeenCalled();
  });
});
