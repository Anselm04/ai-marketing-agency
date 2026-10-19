import { generateAgentResponse, generateCampaignStrategy } from './openaiService.js';
import contentStudio from './contentStudio.js';
import videoStudio from './videoStudio.js';
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

function settledError(result, label) {
  if (result.status !== 'rejected') return null;
  return {
    component: label,
    error: result.reason?.message || String(result.reason || 'Unknown generation failure'),
  };
}

/**
 * Product Marketing Service
 *
 * Generates a real marketing campaign from live AI provider output.
 * Placeholder content is never persisted as if it were generated content.
 */
class ProductMarketingService {
  async runMarketing({ productName, description, photos = [], platforms, targetAudience, budget, category, tone, ownerId }) {
    const productProfile = await this._analyzeProduct(productName, description, category, tone, targetAudience);

    const strategy = await generateCampaignStrategy(
      productProfile.name || productName || 'Product',
      budget || 1000,
      platforms || ['TikTok', 'Instagram', 'Google'],
      productProfile.targetAudience || targetAudience || 'general consumers',
    );
    if (!strategy || strategy.fallback === true || !strategy.strategy) {
      throw new Error(`Campaign strategy generation failed: ${strategy?.missingKey || strategy?.strategy?.error || 'AI provider unavailable'}`);
    }

    const allPlatforms = platforms || ['TikTok', 'Instagram', 'Google', 'LinkedIn', 'Facebook'];
    const productNameFinal = productProfile.name || productName || 'Product';
    const productDesc = productProfile.description || description;
    const audience = productProfile.targetAudience || targetAudience || 'general consumers';

    const [
      adCopyResults,
      socialPostsResults,
      videoScriptResult,
      emailSequenceResult,
      seoResult,
      blogPostResult,
      productDescriptionResult,
    ] = await Promise.allSettled([
      this._generateAdCopyForPlatforms(productNameFinal, productDesc, audience, allPlatforms),
      this._generateSocialPosts(productNameFinal, productDesc, audience, allPlatforms, tone),
      this._generateVideoScript(productNameFinal, audience),
      this._generateEmailSequence(productNameFinal, productDesc, audience, tone),
      this._generateSEO(productNameFinal, productDesc),
      this._generateBlogPost(productNameFinal, tone),
      this._generateProductDescription(productNameFinal, productDesc, tone),
    ]);

    const generationErrors = [
      settledError(adCopyResults, 'ad_copy'),
      settledError(socialPostsResults, 'social_posts'),
      settledError(videoScriptResult, 'video_script'),
      settledError(emailSequenceResult, 'email_sequence'),
      settledError(seoResult, 'seo'),
      settledError(blogPostResult, 'blog_post'),
      settledError(productDescriptionResult, 'product_description'),
    ].filter(Boolean);

    const campaign = await store.createCampaign({
      name: `AI Marketing: ${productNameFinal}`,
      productName: productNameFinal,
      description: productDesc,
      productProfile,
      platforms: allPlatforms,
      budget: budget || 1000,
      targetAudience: audience,
      category: category || 'other',
      tone: tone || 'professional',
      strategy: strategy.strategy,
      photos: photos.map((p) => ({ url: p.url, name: p.originalName })),
      status: generationErrors.length ? 'attention_required' : 'draft',
      generationStatus: generationErrors.length ? 'partial_failure' : 'complete',
      generationErrors,
      owner: ownerId,
    });

    const contentItems = [];

    if (productDescriptionResult.status === 'fulfilled') {
      contentItems.push(await store.createContent({
        title: `${productNameFinal} — Product Description`,
        type: 'product_description',
        body: productDescriptionResult.value,
        platform: 'website',
        campaignId: campaign.id,
        owner: ownerId,
      }));
    }

    if (adCopyResults.status === 'fulfilled') {
      for (const [platform, copy] of Object.entries(adCopyResults.value)) {
        contentItems.push(await store.createContent({
          title: `${platform} Ad — ${productNameFinal}`,
          type: 'ad_copy',
          body: copy,
          platform,
          campaignId: campaign.id,
          owner: ownerId,
        }));
      }
    }

    if (socialPostsResults.status === 'fulfilled') {
      for (const [platform, post] of Object.entries(socialPostsResults.value)) {
        contentItems.push(await store.createContent({
          title: `${platform} Post — ${productNameFinal}`,
          type: 'social_post',
          body: post,
          platform,
          campaignId: campaign.id,
          owner: ownerId,
        }));
      }
    }

    if (emailSequenceResult.status === 'fulfilled') {
      contentItems.push(await store.createContent({
        title: `Email Sequence — ${productNameFinal}`,
        type: 'email_sequence',
        body: emailSequenceResult.value,
        platform: 'email',
        campaignId: campaign.id,
        owner: ownerId,
      }));
    }

    if (seoResult.status === 'fulfilled') {
      contentItems.push(await store.createContent({
        title: `SEO Package — ${productNameFinal}`,
        type: 'seo_text',
        body: seoResult.value,
        platform: 'seo',
        campaignId: campaign.id,
        owner: ownerId,
      }));
    }

    if (blogPostResult.status === 'fulfilled') {
      contentItems.push(await store.createContent({
        title: `Blog Post: Introducing ${productNameFinal}`,
        type: 'article',
        body: blogPostResult.value,
        platform: 'blog',
        campaignId: campaign.id,
        owner: ownerId,
      }));
    }

    return {
      campaign,
      contentItems,
      productProfile,
      strategy: strategy.strategy,
      generationErrors,
      videoScript: videoScriptResult.status === 'fulfilled' ? videoScriptResult.value : null,
      emailSequence: emailSequenceResult.status === 'fulfilled' ? emailSequenceResult.value : null,
      seoKeywords: seoResult.status === 'fulfilled' ? seoResult.value : null,
      socialPosts: socialPostsResults.status === 'fulfilled' ? socialPostsResults.value : null,
      adCopy: adCopyResults.status === 'fulfilled' ? adCopyResults.value : null,
      productDescription: productDescriptionResult.status === 'fulfilled' ? productDescriptionResult.value : null,
    };
  }

  async _analyzeProduct(productName, description, category, tone, targetAudience) {
    const prompt = `Analyze this product and create a marketing profile.

Product Name: ${productName || 'Not specified'}
Description: ${description}
Category: ${category || 'unknown'}
Tone: ${tone || 'professional'}
Target Audience: ${targetAudience || 'general consumers'}

Return ONLY a JSON object with this exact structure:
{
  "name": "compelling product name",
  "tagline": "short punchy tagline (under 10 words)",
  "description": "compelling 2-sentence product description",
  "keyFeatures": ["feature 1", "feature 2", "feature 3", "feature 4"],
  "benefits": ["benefit 1", "benefit 2", "benefit 3"],
  "targetAudience": "specific audience description",
  "painPoints": ["pain point 1", "pain point 2"],
  "pricePositioning": "budget|mid-range|premium|luxury",
  "category": "product category"
}`;

    const result = await generateAgentResponse('chief-strategy', prompt, {});
    const content = requireGeneratedText(result, 'Product analysis');
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Product analysis generation failed: AI response did not contain JSON');
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Product analysis generation failed: invalid JSON (${error.message})`);
    }
  }

  async _generateAdCopyForPlatforms(productName, description, audience, platforms) {
    const entries = await Promise.all(platforms.map(async (platform) => {
      const result = await contentStudio.generateAdCopy(platform, productName, audience, 'Shop Now');
      return [platform, requireGeneratedText(result, `${platform} ad copy`)];
    }));
    return Object.fromEntries(entries);
  }

  async _generateSocialPosts(productName, description, audience, platforms, tone) {
    const entries = await Promise.all(platforms.map(async (platform) => {
      const result = await generateAgentResponse(
        'social-media',
        `Create a social media post for ${platform} promoting "${productName}". Context: ${description}. Audience: ${audience}. Tone: ${tone || 'professional'}. Include 5-10 relevant hashtags.`,
        {},
      );
      return [platform, requireGeneratedText(result, `${platform} social post`)];
    }));
    return Object.fromEntries(entries);
  }

  async _generateEmailSequence(productName, description, audience, tone) {
    const result = await generateAgentResponse(
      'content',
      `Write a 3-email marketing sequence for "${productName}". Context: ${description}. Audience: ${audience}. Tone: ${tone || 'professional'}.

Email 1: Welcome/Announcement (subject line + body)
Email 2: Value/Social Proof (subject line + body)
Email 3: Urgency/CTA (subject line + body)

Format each email with clear Subject: and Body: sections.`,
      {},
    );
    return requireGeneratedText(result, 'Email sequence');
  }

  async _generateSEO(productName, description) {
    const result = await generateAgentResponse(
      'seo-aeo',
      `Create an SEO package for "${productName}". Context: ${description}.

Return:
1. Primary keyword
2. 5-10 secondary keywords
3. Meta title (under 60 chars)
4. Meta description (under 160 chars)
5. Suggested URL slug
6. 3 blog topic ideas`,
      {},
    );
    return requireGeneratedText(result, 'SEO package');
  }

  async _generateBlogPost(productName, tone) {
    const result = await contentStudio.generateArticle(productName, [], tone, 800);
    return requireGeneratedText(result, 'Blog post');
  }

  async _generateProductDescription(productName, description, tone) {
    const result = await generateAgentResponse(
      'content',
      `Write a compelling product description (150-250 words) for "${productName}". Description context: ${description}. Tone: ${tone || 'professional'}. Include key features, benefits, and a call to action.`,
      {},
    );
    return requireGeneratedText(result, 'Product description');
  }

  async _generateVideoScript(productName, audience) {
    const result = await videoStudio.generateVideoAd(productName, audience, 30);
    return requireGeneratedText(result, 'Video script');
  }
}

export default new ProductMarketingService();
