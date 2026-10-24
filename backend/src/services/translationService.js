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
    const results = await Promise.all(
      targetLanguages.map(lang => this.translate(content, lang).then(r => ({ language: lang, ...r })))
    );
    return results;
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

