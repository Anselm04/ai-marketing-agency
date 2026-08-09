import { generateAgentResponse } from './openaiService.js';
import store from '../utils/store.js';

class ContentStudio {
  async generateArticle(topic, keywords, tone = 'professional', length = 800) {
    const result = await generateAgentResponse('content', `Write a ${length}-word ${tone} article about "${topic}". Include these keywords naturally: ${keywords.join(', ')}.`, {});
    return result;
  }

  async generateAdCopy(platform, product, audience, cta) {
    const result = await generateAgentResponse('content', `Write ad copy for ${platform} promoting "${product}" to ${audience}. Include CTA: "${cta}". Keep it under 150 words.`, {});
    return result;
  }

  async generateScript(videoType, topic, duration) {
    const result = await generateAgentResponse('video', `Write a ${duration}-second ${videoType} script about "${topic}". Include hook, body, and CTA.`, {});
    return result;
  }

  async generateEmail(type, recipient, product, tone) {
    const result = await generateAgentResponse('content', `Write a ${type} email to ${recipient} about ${product}. Tone: ${tone}. Include subject line and body.`, {});
    return result;
  }

  async optimizeSeo(content, targetKeywords) {
    const result = await generateAgentResponse('seo-aeo', `Optimize this content for SEO using keywords: ${targetKeywords.join(', ')}. Provide improved title, meta description, and keyword suggestions.\n\nContent: ${content.slice(0, 1000)}`, {});
    return result;
  }

  async saveContent(data, ownerId) {
    return await store.createContent({ ...data, owner: ownerId });
  }

  async getContent(ownerId, filters = {}) {
    return (await store.getContent()).filter(c => c.owner === ownerId && Object.entries(filters).every(([k, v]) => c[k] === v));
  }

  async bulkGenerate(type, topics, platform, ownerId) {
    const results = await Promise.all(
      topics.map(async (topic) => {
        let result;
        if (type === 'article') result = await this.generateArticle(topic, []);
        else if (type === 'ad_copy') result = await this.generateAdCopy(platform, topic, 'general', 'Learn more');
        else if (type === 'script') result = await this.generateScript('short-form', topic, 30);
        else result = await generateAgentResponse('content', `Create ${type} about ${topic}`, {});

        return this.saveContent({
          title: topic,
          type,
          body: result.content || (result.fallback ? `[Draft] ${topic}` : ''),
          platform,
          status: 'draft',
          owner: ownerId,
        }, ownerId);
      })
    );
    return results;
  }
}

export default new ContentStudio();
