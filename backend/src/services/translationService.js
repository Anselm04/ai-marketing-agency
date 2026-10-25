import { generateAgentResponse } from './openaiService.js';

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch',
  'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Turkish',
  'Polish', 'Swedish', 'Vietnamese', 'Thai', 'Indonesian', 'Greek',
];

class TranslationService {
  async translate(content, targetLanguage, sourceLanguage = 'English') {
    if (targetLanguage === sourceLanguage) {
      return { translated: content, language: targetLanguage, auto: false };
    }

    const result = await generateAgentResponse('content', `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Maintain the original tone, formatting, and marketing intent. Only return the translated text, no explanations.\n\nText: ${content}`, {});

    const fallback = Boolean(result.fallback || !result.content?.trim());
    return {
      translated: fallback ? `[${targetLanguage}] ${content}` : result.content,
      language: targetLanguage,
      auto: true,
      fallback,
    };
  }

  async translateToMultiple(content, targetLanguages) {
    const outcomes = await Promise.allSettled(
      targetLanguages.map(lang => this.translate(content, lang))
    );
    const hasSuccess = outcomes.some(outcome => outcome.status === 'fulfilled'
      && !outcome.value.fallback && typeof outcome.value.translated === 'string' && outcome.value.translated.trim());
    // Preserve the normal HTTP error when nothing usable completed. Otherwise
    // return each language's outcome so completed work is not lost to one failure.
    const rejection = outcomes.find(outcome => outcome.status === 'rejected' && outcome.reason?.code === 'plan_quota_exceeded')
      || outcomes.find(outcome => outcome.status === 'rejected');
    if (!hasSuccess && rejection) throw rejection.reason;
    return outcomes.map((outcome, index) => {
      const language = targetLanguages[index];
      if (outcome.status === 'fulfilled') return { language, ...outcome.value };
      const status = outcome.reason?.status || outcome.reason?.statusCode;
      const code = outcome.reason?.code;
      return {
        language, translated: null, fallback: true,
        status: status === 402 ? 402 : 503,
        errorCode: ['plan_quota_exceeded', 'marketing_entitlement_required'].includes(code) ? code : 'translation_failed',
      };
    });
  }

  async detectLanguage(text) {
    const result = await generateAgentResponse('content', `Detect the language of this text and respond with only the language name in English.\n\nText: ${text.slice(0, 200)}`, {});
    return result.content?.trim() || 'Unknown';
  }

  getSupportedLanguages() {
    return LANGUAGES;
  }
}

export default new TranslationService();

