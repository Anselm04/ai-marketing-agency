import { describe, it, expect, jest } from '@jest/globals';
import { requestVoice, voiceCapabilities, VoiceHarnessError } from './voice-harness.js';
import { VoiceProviderDisabledError } from './elevenlabs.js';

const env = {
  ELEVENLABS_ENABLED: 'true',
  ELEVENLABS_API_KEY: 'mock-key',
  ELEVENLABS_VOICE_ID: 'voice_test',
};

const authorised = {
  verified: true,
  provider: 'elevenlabs',
  task: 'text-to-speech',
  tenantId: 'tenant-test',
  budgetApproved: true,
  consentApproved: true,
  meteringReady: true,
};

describe('TrillionAI voice harness', () => {
  it('has no enabled customer workflows by default', () => {
    const result = voiceCapabilities(env);
    expect(result.enabled).toBe(false);
    expect(result.providers.elevenlabs.configured).toBe(true);
  });

  it('blocks calls even if ElevenLabs credentials are set', async () => {
    const fetchImpl = jest.fn();
    await expect(requestVoice({
      provider: 'elevenlabs', task: 'text-to-speech', text: 'hi',
      authorisation: authorised, env, fetchImpl,
    })).rejects.toBeInstanceOf(VoiceProviderDisabledError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects unknown providers without network traffic', async () => {
    const fetchImpl = jest.fn();
    await expect(requestVoice({ provider: 'unknown', task: 'text-to-speech', env, fetchImpl }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(['verified', 'budgetApproved', 'consentApproved', 'meteringReady'])(
    'blocks missing %s approval before network',
    async (field) => {
      const fetchImpl = jest.fn();
      await expect(requestVoice({
        provider: 'elevenlabs', task: 'text-to-speech', text: 'hi',
        authorisation: { ...authorised, [field]: false },
        env: { ...env, TRILLIONAI_VOICE_WORKFLOWS_ENABLED: 'true' }, fetchImpl,
      })).rejects.toBeInstanceOf(VoiceHarnessError);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('works with local mock only when every future gate is present', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(Buffer.from('mock-audio'), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    }));
    const result = await requestVoice({
      provider: 'elevenlabs', task: 'text-to-speech', text: 'approved',
      authorisation: authorised,
      env: { ...env, TRILLIONAI_VOICE_WORKFLOWS_ENABLED: 'true' },
      fetchImpl,
    });
    expect(result.audio.toString()).toBe('mock-audio');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
