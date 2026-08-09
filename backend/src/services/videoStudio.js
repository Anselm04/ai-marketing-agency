import { generateAgentResponse } from './openaiService.js';

class VideoStudio {
  async generateScript(videoType, topic, duration, platform = 'TikTok') {
    const result = await generateAgentResponse('video', `Write a ${duration}-second ${videoType} video script for ${platform} about "${topic}".\n\nStructure:\n1. Hook (0-3s)\n2. Problem/Setup (3-${Math.floor(duration * 0.3)}s)\n3. Solution/Value (${Math.floor(duration * 0.3)}-${Math.floor(duration * 0.7)}s)\n4. CTA (${Math.floor(duration * 0.7)}-${duration}s)\n\nAlso suggest visual cues, text overlays, and audio mood.`, {});
    return result;
  }

  async generateStoryboard(script, style = 'modern') {
    const result = await generateAgentResponse('video', `Create a visual storyboard for this video script. Break it into 5-8 scenes with shot descriptions, camera angles, and on-screen text suggestions. Style: ${style}.\n\nScript: ${script.slice(0, 500)}`, {});
    return result;
  }

  async suggestThumbnails(topic, brandColors) {
    const result = await generateAgentResponse('content', `Suggest 5 thumbnail concepts for a video about "${topic}". Brand colors: ${brandColors}. Include layout, text, and emotional hook for each.`, {});
    return result;
  }

  async suggestHashtags(topic, platform) {
    const result = await generateAgentResponse('social-media', `Suggest 10 viral hashtags for a video about "${topic}" on ${platform}. Include 3 broad, 4 niche, and 3 trending-style hashtags.`, {});
    return result;
  }

  async generateVideoAd(product, audience, duration = 15) {
    const result = await generateAgentResponse('video', `Write a high-converting ${duration}-second video ad script for "${product}" targeting "${audience}". Include: hook, social proof, offer, urgency, CTA. Also suggest B-roll and music mood.`, {});
    return result;
  }
}

export default new VideoStudio();
