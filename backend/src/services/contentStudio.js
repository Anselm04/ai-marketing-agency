import { generateAgentResponse } from './openaiService.js';
import store from '../utils/store.js';

function requireGeneratedText(result, label) {
  if (!result || result.fallback === true) {
    const reason = result?.error || result?.missingKey || 'AI provider returned fallback mode';
    throw new Error(`${label} generation failed: ${reason}`);
  }
  const content = String(result.content || '').trim();
  if (!content) throw new Error(`${label} generation failed: empty AI response`);
  return content;
}

class ContentStudio {
  async generateArticle(topic, keywords, tone = 'professional', length = 800) {
    return generateAgentResponse(
      'content',
      `Write a ${length}-word ${tone} article about "${topic}". Include these keywords naturally: ${keywords.join(', ')}.`,
      {},
    );
  }

  async generateAdCopy(platform, product, audience, cta) {
    return generateAgentResponse(
      'content',
      `Write ad copy for ${platform} promoting "${product}" to ${audience}. Include CTA: "${cta}". Keep it under 150 words.`,
      {},
    );
  }

  async generateScript(videoType, topic, duration) {
    return generateAgentResponse(
      'video',
      `Write a ${duration}-second ${videoType} script about "${topic}". Include hook, body, and CTA.`,
      {},
    );
  }

  async generateEmail(type, recipient, product, tone) {
    return generateAgentResponse(
      'content',
      `Write a ${type} email to ${recipient} about ${product}. Tone: ${tone}. Include subject line and body.`,
      {},
    );
  }

  async optimizeSeo(content, targetKeywords) {
    return generateAgentResponse(
      'seo-aeo',
      `Optimize this content for SEO using keywords: ${targetKeywords.join(', ')}. Provide improved title, meta description, and keyword suggestions.\n\nContent: ${content.slice(0, 1000)}`,
      {},
    );
  }

  async saveContent(data, ownerId) {
    return store.createContent({ ...data, owner: ownerId });
  }

  async getContent(ownerId, filters = {}) {
    const content = await store.getContent();
    return content.filter(
      (item) => item.owner === ownerId
        && Object.entries(filters).every(([key, value]) => item[key] === value),
    );
  }

  async bulkGenerate(type, topics, platform, ownerId) {
    return Promise.all(topics.map(async (topic) => {
      let result;
      if (type === 'article') result = await this.generateArticle(topic, []);
      else if (type === 'ad_copy') result = await this.generateAdCopy(platform, topic, 'general', 'Learn more');
      else if (type === 'script') result = await this.generateScript('short-form', topic, 30);
      else result = await generateAgentResponse('content', `Create ${type} about ${topic}`, {});

      const body = requireGeneratedText(result, `${type} content for ${topic}`);
      return this.saveContent({
        title: topic,
        type,
        body,
        platform,
        status: 'draft',
      }, ownerId);
    }));
  }
}

export default new ContentStudio();
