/**
 * TrillionAI voice provider harness.
 * Side-effect free: no routes, background tasks, subscriptions or provider calls
 * are started by importing or constructing this module.
 */
import { synthesizeElevenLabs, elevenLabsConfigured, VoiceProviderDisabledError } from './elevenlabs.js';

export class VoiceHarnessError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'VoiceHarnessError';
    this.code = code;
  }
}

const PROVIDER_NAME = 'elevenlabs';

/** Read-only capability discovery; never attempts a provider connection. */
export function voiceCapabilities(env = process.env) {
  return Object.freeze({
    enabled: false, // No product workflow is authorised to send paid calls yet.
    providers: Object.freeze({
      [PROVIDER_NAME]: Object.freeze({
        configured: elevenLabsConfigured(env),
        supportedTasks: Object.freeze(['text-to-speech']),
      }),
    }),
  });
}

/**
 * Explicit integration contract for a future authenticated, metered voice workflow.
 * Requiring a server-issued, verified authorisation object keeps this harness
 * unavailable to callers that lack the future billing and policy middleware.
 *
 * The object must be created by trusted middleware after checking identity,
 * tenant ownership, consent, entitlement, spending limits and recording usage.
 */
export async function requestVoice({
  provider,
  task,
  text,
  voiceId,
  authorisation,
  env = process.env,
  fetchImpl,
} = {}) {
  if (provider !== PROVIDER_NAME || task !== 'text-to-speech') {
    throw new VoiceHarnessError('Unsupported voice provider or task', 'UNSUPPORTED');
  }
  // The feature gate prevents chargeable calls in all current environments.
  if (env.TRILLIONAI_VOICE_WORKFLOWS_ENABLED !== 'true') {
    throw new VoiceProviderDisabledError();
  }
  if (
    !authorisation ||
    authorisation.verified !== true ||
    authorisation.provider !== provider ||
    authorisation.task !== task ||
    typeof authorisation.tenantId !== 'string' ||
    !authorisation.tenantId.trim() ||
    authorisation.budgetApproved !== true ||
    authorisation.consentApproved !== true ||
    authorisation.meteringReady !== true
  ) {
    throw new VoiceHarnessError('Voice request not authorised', 'NOT_AUTHORISED');
  }
  if (!elevenLabsConfigured(env)) throw new VoiceProviderDisabledError();
  return synthesizeElevenLabs({ text, voiceId, env, fetchImpl });
}
