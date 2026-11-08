import { describe, it, expect, jest } from '@jest/globals';
import { elevenLabsConfigured, synthesizeElevenLabs, VoiceProviderDisabledError } from './elevenlabs.js';

const enabled = {
  ELEVENLABS_ENABLED: 'true',
  ELEVENLABS_API_KEY: 'test-key',
  ELEVENLABS_VOICE_ID: 'voice_123',
};
describe('ElevenLabs optional integration', () => {
  it('is disabled by default with no network calls', async () => {
    const fetchImpl = jest.fn();
    expect(elevenLabsConfigured({})).toBe(false);
    await expect(synthesizeElevenLabs({ text: 'hello', env: {}, fetchImpl }))
      .rejects.toBeInstanceOf(VoiceProviderDisabledError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('requires all three enablement settings', () => {
    expect(elevenLabsConfigured({ ...enabled, ELEVENLABS_API_KEY: '' })).toBe(false);
    expect(elevenLabsConfigured({ ...enabled, ELEVENLABS_ENABLED: 'false' })).toBe(false);
  });
  it('rejects invalid input before network calls', async () => {
    const fetchImpl = jest.fn();
    await expect(synthesizeElevenLabs({ text: 'x'.repeat(5001), env: enabled, fetchImpl }))
      .rejects.toThrow(RangeError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('generates audio only on an explicit enabled request', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(Buffer.from('mock-mp3'), {
      status: 200, headers: { 'content-type': 'audio/mpeg' },
    }));
    const result = await synthesizeElevenLabs({ text: 'Test narration', env: enabled, fetchImpl });
    expect(result.provider).toBe('elevenlabs');
    expect(result.audio.toString()).toBe('mock-mp3');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toContain('/v1/text-to-speech/voice_123');
    expect(request.headers['xi-api-key']).toBe('test-key');
  });
  it('rejects provider errors without exposing response text or key', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('secret information', { status: 401 }));
    await expect(synthesizeElevenLabs({ text: 'hi', env: enabled, fetchImpl }))
      .rejects.toThrow('HTTP 401');
  });
});
