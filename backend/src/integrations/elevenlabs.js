/**
 * Optional ElevenLabs text-to-speech integration.
 * Fail-closed: no outbound calls or charges unless explicitly enabled and invoked.
 * The caller must enforce customer permissions, entitlements and metered billing.
 */
const DEFAULT_API_ORIGIN = 'https://api.elevenlabs.io';
const MAX_TEXT_CHARS = 5000;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export class VoiceProviderDisabledError extends Error {
  constructor() {
    super('ElevenLabs integration is disabled');
    this.name = 'VoiceProviderDisabledError';
  }
}

export function elevenLabsConfigured(env = process.env) {
  return env.ELEVENLABS_ENABLED === 'true' &&
    Boolean(env.ELEVENLABS_API_KEY?.trim()) &&
    Boolean(env.ELEVENLABS_VOICE_ID?.trim());
}

/**
 * Explicit call only. Never invokes billing, onboarding, or subscription purchase.
 * @param {object} options
 * @param {string} options.text Text approved by a human or an authorised workflow.
 * @param {string} [options.voiceId] Voice ID, defaults to ELEVENLABS_VOICE_ID.
 * @param {object} [options.env] Configuration injection for testing.
 * @param {typeof fetch} [options.fetchImpl] Fetch injection for testing.
 * @returns {Promise<{audio: Buffer, contentType: string, provider: string}>}
 */
export async function synthesizeElevenLabs({
  text,
  voiceId,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!elevenLabsConfigured(env)) throw new VoiceProviderDisabledError();
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT_CHARS) {
    throw new RangeError('Voice text must contain 1 to 5000 characters');
  }
  const selectedVoiceId = voiceId ?? env.ELEVENLABS_VOICE_ID;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(selectedVoiceId)) {
    throw new TypeError('Invalid ElevenLabs voice ID');
  }

  const timeout = AbortSignal.timeout(15_000);
  const response = await fetchImpl(
    `${DEFAULT_API_ORIGIN}/v1/text-to-speech/${encodeURIComponent(selectedVoiceId)}`,
    {
      method: 'POST',
      signal: timeout,
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text, model_id: env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2' }),
    },
  );
  if (!response.ok) {
    // Never log the response or API key; upstream error bodies may contain sensitive data.
    throw new Error(`ElevenLabs request failed with HTTP ${response.status}`);
  }
  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_AUDIO_BYTES) {
    await response.body?.cancel();
    throw new RangeError('Voice audio response exceeds size limit');
  }
  // Content length may be absent or incorrect. Bound streamed consumption as well.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('ElevenLabs returned no audio body');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_AUDIO_BYTES) {
        await reader.cancel();
        throw new RangeError('Voice audio response exceeds size limit');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new Error('ElevenLabs returned empty audio');
  return { audio: Buffer.concat(chunks), contentType: 'audio/mpeg', provider: 'elevenlabs' };
}
