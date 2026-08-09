import { generateAgentResponse, generateCampaignStrategy } from './aiService.js';
import contentStudio from './contentStudio.js';
import videoStudio from './videoStudio.js';
import store from '../utils/store.js';

/**
 * Product Marketing Service
 *
 * Orchestrates AI agents to automatically generate a complete marketing campaign
 * from a product description (and optionally product photos).
 *
 * Workflow:
 * 1. Product Analysis Agent → product profile, tagline, features, audience
 * 2. Campaign Strategy Agent → budget allocation, timeline, KPIs, content ideas
 * 3. Content Generation (parallel) → ad copy, social captions, email, video script, SEO, blog
 * 4. Persistence → saves campaign, content items, and product record
 */

class ProductMarketingService {
  async runMarketing({ productName, description, photos = [], platforms, targetAudience, budget, category, tone, ownerId }) {
    // Step 1: Product Analysis (required for downstream agents)
    const productProfile = await this._analyzeProduct(productName, description, category, tone, targetAudience);

    // Step 2: Campaign Strategy (parallel with content generation after profile)
    const strategy = await generateCampaignStrategy(
      productProfile.name || productName || 'Product',
      budget || 1000,
      platforms || ['TikTok', 'Instagram', 'Google'],
      productProfile.targetAudience || targetAudience || 'general consumers'
    );

    // Step 3: Generate all content in parallel
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
      this._generateAdCopyForPlatforms(productNameFinal, productDesc, audience, allPlatforms, tone),
      this._generateSocialPosts(productNameFinal, productDesc, audience, allPlatforms, tone),
      videoStudio.generateVideoAd(productNameFinal, audience, 30),
      this._generateEmailSequence(productNameFinal, productDesc, audience, tone),
      this._generateSEO(productNameFinal, productDesc, allPlatforms),
      contentStudio.generateArticle(productNameFinal, [], tone, 800),
      generateAgentResponse('content', `Write a compelling product description (150-250 words) for "${productNameFinal}". Description context: ${productDesc}. Tone: ${tone || 'professional'}. Include key features, benefits, and a call to action.`, {}),
    ]);

    // Step 4: Persist everything
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
      strategy,
      photos: photos.map(p => ({ url: p.url, name: p.originalName })),
      status: 'draft',
      owner: ownerId,
    });

    const contentItems = [];

    // Product description
    if (productDescriptionResult.status === 'fulfilled') {
      contentItems.push(await store.createContent({
        title: `${productNameFinal} — Product Description`,
        type: 'product_description',
        body: productDescriptionResult.value || `Product description for ${productNameFinal}.`,
        platform: 'website',
        campaignId: campaign.id,
        owner: ownerId,
      }));
    }

    // Ad copy for each platform
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

    // Social posts for each platform
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

    // Email sequence
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

    // SEO keywords
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

    // Blog post
    if (blogPostResult.status === 'fulfilled') {
      contentItems.push(await store.createContent({
        title: `Blog Post: Introducing ${productNameFinal}`,
        type: 'article',
        body: blogPostResult.value || `Blog post about ${productNameFinal}.`,
        platform: 'blog',
        campaignId: campaign.id,
        owner: ownerId,
      }));
    }

    // Video script
    const videoScript = videoScriptResult.status === 'fulfilled' ? videoScriptResult.value : `Video ad script for ${productNameFinal}.`;

    // Add a lead record for the product (for CRM tracking)
    await store.createLead({
      firstName: 'Auto',
      lastName: 'Generated',
      email: `campaign+${campaign.id}@placeholder.local`,
      company: productNameFinal,
      source: 'ai_product_marketing',
      status: 'new',
      notes: `AI-generated marketing campaign for ${productNameFinal}. Platforms: ${allPlatforms.join(', ')}.`,
      campaignId: campaign.id,
      owner: ownerId,
    });

    return {
      campaign,
      contentItems,
      productProfile,
      strategy,
      videoScript: videoScript || videoScript,
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

    try {
      const result = await generateAgentResponse('chief-strategy', prompt, {});
      if (result.startsWith('[')) {
        return this._defaultProductProfile(productName, description, category, targetAudience);
      }
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return this._defaultProductProfile(productName, description, category, targetAudience);
    } catch (err) {
      console.error('Product analysis error:', err.message);
      return this._defaultProductProfile(productName, description, category, targetAudience);
    }
  }

  _defaultProductProfile(productName, description, category, targetAudience) {
    return {
      name: productName || 'Your Product',
      tagline: 'The smarter choice for modern consumers.',
      description: description || 'A premium product designed for discerning customers.',
      keyFeatures: ['High quality', 'Easy to use', 'Great value', 'Trusted brand'],
      benefits: ['Saves time', 'Reduces stress', 'Improves results'],
      targetAudience: targetAudience || 'General consumers aged 25-45',
      painPoints: ['Wasted time on inferior solutions', 'Overpaying for less quality'],
      pricePositioning: 'mid-range',
      category: category || 'other',
    };
  }

  async _generateAdCopyForPlatforms(productName, description, audience, platforms, tone) {
    const results = {};
    await Promise.all(
      platforms.map(async (platform) => {
        try {
          const result = await contentStudio.generateAdCopy(
            platform,
            productName,
            audience,
            'Shop Now'
          );
          results[platform] = result || `[Ad copy for ${platform}] ${description.slice(0, 100)}`;
        } catch (err) {
          results[platform] = `[Draft] ${platform} ad for ${productName}`;
        }
      })
    );
    return results;
  }

  async _generateSocialPosts(productName, description, audience, platforms, tone) {
    const results = {};
    await Promise.all(
      platforms.map(async (platform) => {
        try {
          const result = await generateAgentResponse(
            'social-media',
            `Create a social media post for ${platform} promoting "${productName}". Context: ${description}. Audience: ${audience}. Tone: ${tone || 'professional'}. Include 5-10 relevant hashtags.`,
            {}
          );
          results[platform] = result || `Excited to share ${productName}! ${description.slice(0, 80)}... #product #new`;
        } catch (err) {
          results[platform] = `[Draft] ${platform} post for ${productName}`;
        }
      })
    );
    return results;
  }

  async _generateEmailSequence(productName, description, audience, tone) {
    try {
      const result = await generateAgentResponse(
        'content',
        `Write a 3-email marketing sequence for "${productName}". Context: ${description}. Audience: ${audience}. Tone: ${tone || 'professional'}.

Email 1: Welcome/Announcement (subject line + body)
Email 2: Value/Social Proof (subject line + body)
Email 3: Urgency/CTA (subject line + body)

Format each email with clear Subject: and Body: sections.`,
        {}
      );
      return result || `Email sequence for ${productName}.`;
    } catch (err) {
      return `Email sequence for ${productName}.`;
    }
  }

  async _generateSEO(productName, description, platforms) {
    try {
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
        {}
      );
      return result || `SEO keywords for ${productName}.`;
    } catch (err) {
      return `SEO keywords for ${productName}.`;
    }
  }
}

export default new ProductMarketingService();
