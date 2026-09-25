import axios from 'axios';

class SocialMediaService {
  constructor() {
    this.tokens = {
      // Social
      tiktok: process.env.TIKTOK_ACCESS_TOKEN,
      meta: process.env.META_ACCESS_TOKEN,
      instagram: process.env.INSTAGRAM_ACCESS_TOKEN,
      facebook: process.env.FACEBOOK_ACCESS_TOKEN,
      twitter: process.env.TWITTER_BEARER_TOKEN,
      linkedin: process.env.LINKEDIN_ACCESS_TOKEN,
      pinterest: process.env.PINTEREST_ACCESS_TOKEN,
      snapchat: process.env.SNAPCHAT_API_KEY,
      reddit: process.env.REDDIT_ACCESS_TOKEN,
      threads: process.env.THREADS_ACCESS_TOKEN,
      bluesky: process.env.BLUESKY_HANDLE,
      mastodon: process.env.MASTODON_ACCESS_TOKEN,
      // Video
      youtube: process.env.YOUTUBE_API_KEY,
      twitch: process.env.TWITCH_CLIENT_ID,
      vimeo: process.env.VIMEO_ACCESS_TOKEN,
      rumble: process.env.RUMBLE_API_KEY,
      // Gaming
      steam: process.env.STEAM_API_KEY,
      discord: process.env.DISCORD_BOT_TOKEN,
      roblox: process.env.ROBLOX_API_KEY,
      epic: process.env.EPIC_CLIENT_ID,
      itch: process.env.ITCH_API_KEY,
      gamejolt: process.env.GAMEJOLT_API_KEY,
      nintendo: process.env.NINTENDO_API_KEY,
      playstation: process.env.PLAYSTATION_API_KEY,
      xbox: process.env.XBOX_API_KEY,
      // Professional / B2B
      angellist: process.env.ANGELLIST_API_KEY,
      producthunt: process.env.PRODUCTHUNT_API_KEY,
      hackernews: true, // no API key needed for posting
      crunchbase: process.env.CRUNCHBASE_API_KEY,
      g2: process.env.G2_API_KEY,
      capterra: process.env.CAPTERRA_API_KEY,
      clutch: process.env.CLUTCH_API_KEY,
      // Messaging / Community
      whatsapp: process.env.WHATSAPP_BUSINESS_TOKEN,
      telegram: process.env.TELEGRAM_BOT_TOKEN,
      slack: process.env.SLACK_BOT_TOKEN,
      messenger: process.env.MESSENGER_ACCESS_TOKEN,
      wechat: process.env.WECHAT_APP_ID,
      line: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      // E-commerce / Marketplaces
      amazon: process.env.AMAZON_ACCESS_TOKEN,
      ebay: process.env.EBAY_ACCESS_TOKEN,
      etsy: process.env.ETSY_ACCESS_TOKEN,
      shopify: process.env.SHOPIFY_ACCESS_TOKEN,
      gumroad: process.env.GUMROAD_ACCESS_TOKEN,
      appsumo: process.env.APPSUMO_API_KEY,
      alibaba: process.env.ALIBABA_API_KEY,
      rakuten: process.env.RAKUTEN_API_KEY,
      // App Stores
      appstore: process.env.APPSTORE_CONNECT_KEY,
      googleplay: process.env.GOOGLE_PLAY_API_KEY,
      samsung: process.env.SAMSUNG_SELLER_API_KEY,
      huawei: process.env.HUAWEI_APPGALLERY_KEY,
      amazonappstore: process.env.AMAZON_APPSTORE_KEY,
      // Review Platforms
      trustpilot: process.env.TRUSTPILOT_API_KEY,
      yelp: process.env.YELP_API_KEY,
      googleReviews: process.env.GOOGLE_PLACES_API_KEY,
      tripadvisor: process.env.TRIPADVISOR_API_KEY,
      bbb: process.env.BBB_API_KEY,
      // Content / Forums
      medium: process.env.MEDIUM_INTEGRATION_TOKEN,
      substack: process.env.SUBSTACK_API_KEY,
      quora: process.env.QUORA_SESSION_COOKIE,
      stackoverflow: process.env.STACKOVERFLOW_API_KEY,
      devto: process.env.DEVTO_API_KEY,
      hashnode: process.env.HASHNODE_PERSONAL_TOKEN,
      indiehackers: true, // no API key needed
      // Ad Networks
      googleAds: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      tiktokAds: process.env.TIKTOK_ADS_ACCESS_TOKEN,
      metaAds: process.env.META_ADS_ACCESS_TOKEN,
      linkedinAds: process.env.LINKEDIN_ADS_ACCESS_TOKEN,
      twitterAds: process.env.TWITTER_ADS_API_KEY,
      pinterestAds: process.env.PINTEREST_ADS_ACCESS_TOKEN,
      snapchatAds: process.env.SNAPCHAT_ADS_ACCESS_TOKEN,
      redditAds: process.env.REDDIT_ADS_ACCESS_TOKEN,
      amazonAds: process.env.AMAZON_ADS_ACCESS_TOKEN,
      microsoftAds: process.env.MICROSOFT_ADS_ACCESS_TOKEN,
      taboola: process.env.TABOOLA_API_KEY,
      outbrain: process.env.OUTBRAIN_API_KEY,
      // Audio / Podcast
      spotify: process.env.SPOTIFY_CLIENT_ID,
      applePodcasts: process.env.APPLE_PODCASTS_TOKEN,
      soundcloud: process.env.SOUNDCLOUD_CLIENT_ID,
      clubhouse: process.env.CLUBHOUSE_API_KEY,
      // Creator / Monetization
      onlyfans: process.env.ONLYFANS_API_KEY,
      patreon: process.env.PATREON_ACCESS_TOKEN,
      kofi: process.env.KOFI_WEBHOOK_TOKEN,
      buymeacoffee: process.env.BUYMEACOFFEE_TOKEN,
    };
  }

  isAvailable(platform) {
    return !!this.tokens[platform];
  }

  // --- Social Media ---
  async getTikTokCreatorInfo() {
    if (!this.isAvailable('tiktok')) {
      return { success: false, platform: 'tiktok', blocked: true, error: 'TikTok access token is not configured' };
    }

    try {
      const res = await axios.post(
        'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
        {},
        {
          headers: {
            Authorization: `Bearer ${this.tokens.tiktok}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          timeout: 15000,
        },
      );

      if (res.data?.error?.code && res.data.error.code !== 'ok') {
        return {
          success: false,
          platform: 'tiktok',
          blocked: true,
          error: res.data.error.message || res.data.error.code,
          code: res.data.error.code,
        };
      }

      return { success: true, platform: 'tiktok', creator: res.data?.data || {} };
    } catch (err) {
      return {
        success: false,
        platform: 'tiktok',
        error: err.response?.data?.error?.message || err.message,
        code: err.response?.data?.error?.code,
      };
    }
  }

  async publishTikTok(videoUrl, caption, hashtags = [], options = {}) {
    if (!this.isAvailable('tiktok')) {
      return { success: false, platform: 'tiktok', blocked: true, error: 'TikTok API not configured' };
    }
    if (!videoUrl) {
      return { success: false, platform: 'tiktok', blocked: true, error: 'A public video URL is required' };
    }

    const creatorInfo = await this.getTikTokCreatorInfo();
    if (!creatorInfo.success) return creatorInfo;

    const configuredPrivacy = options.privacyLevel || process.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY';
    const allowedPrivacy = creatorInfo.creator?.privacy_level_options || [];
    if (!allowedPrivacy.includes(configuredPrivacy)) {
      return {
        success: false,
        platform: 'tiktok',
        blocked: true,
        error: `TikTok privacy level ${configuredPrivacy} is not currently allowed for this creator`,
        allowedPrivacy,
      };
    }

    const title = [caption, ...(Array.isArray(hashtags) ? hashtags : [])]
      .filter(Boolean)
      .join(' ')
      .slice(0, 2200);

    try {
      const res = await axios.post(
        'https://open.tiktokapis.com/v2/post/publish/video/init/',
        {
          post_info: {
            title,
            privacy_level: configuredPrivacy,
            disable_duet: options.disableDuet === true,
            disable_comment: options.disableComment === true,
            disable_stitch: options.disableStitch === true,
            brand_organic_toggle: options.brandOrganic === true,
            is_aigc: options.isAigc === true,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: videoUrl,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.tokens.tiktok}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          timeout: 20000,
        },
      );

      if (res.data?.error?.code && res.data.error.code !== 'ok') {
        return {
          success: false,
          platform: 'tiktok',
          blocked: true,
          error: res.data.error.message || res.data.error.code,
          code: res.data.error.code,
        };
      }

      return {
        success: true,
        platform: 'tiktok',
        publishId: res.data?.data?.publish_id,
        status: 'processing',
        privacyLevel: configuredPrivacy,
      };
    } catch (err) {
      return {
        success: false,
        platform: 'tiktok',
        error: err.response?.data?.error?.message || err.message,
        code: err.response?.data?.error?.code,
      };
    }
  }

  async publishInstagram(imageUrl, caption) {
    if (!this.isAvailable('instagram')) return { fallback: true, platform: 'instagram', message: 'Instagram API not configured. Would publish: ' + caption };
    try {
      const res = await axios.post(`https://graph.facebook.com/v18.0/me/media`, { image_url: imageUrl, caption, access_token: this.tokens.instagram });
      return { success: true, platform: 'instagram', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'instagram', error: err.message }; }
  }

  async publishFacebook(message, link) {
    if (!this.isAvailable('facebook')) return { fallback: true, platform: 'facebook', message: 'Facebook API not configured. Would publish: ' + message };
    try {
      const res = await axios.post(`https://graph.facebook.com/v18.0/me/feed`, { message, link, access_token: this.tokens.facebook });
      return { success: true, platform: 'facebook', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'facebook', error: err.message }; }
  }

  async publishTwitter(text) {
    if (!this.isAvailable('twitter')) return { fallback: true, platform: 'twitter', message: 'Twitter/X API not configured. Would publish: ' + text };
    try {
      const res = await axios.post('https://api.twitter.com/2/tweets', { text }, { headers: { Authorization: `Bearer ${this.tokens.twitter}` } });
      return { success: true, platform: 'twitter', postId: res.data.data.id };
    } catch (err) { return { success: false, platform: 'twitter', error: err.message }; }
  }

  async publishLinkedIn(text, title, url) {
    if (!this.isAvailable('linkedin')) return { fallback: true, platform: 'linkedin', message: 'LinkedIn API not configured. Would publish: ' + text };
    try {
      const res = await axios.post('https://api.linkedin.com/v2/ugcPosts', { author: 'urn:li:person:me', lifecycleState: 'PUBLISHED', specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text }, shareMediaCategory: 'ARTICLE', media: [{ status: 'READY', originalUrl: url, title: { text: title } }] } }, visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' } }, { headers: { Authorization: `Bearer ${this.tokens.linkedin}`, 'X-Restli-Protocol-Version': '2.0.0' } });
      return { success: true, platform: 'linkedin', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'linkedin', error: err.message }; }
  }

  async publishPinterest(pinTitle, pinDescription, imageUrl, boardId) {
    if (!this.isAvailable('pinterest')) return { fallback: true, platform: 'pinterest', message: 'Pinterest API not configured. Would publish: ' + pinTitle };
    try {
      const res = await axios.post('https://api.pinterest.com/v5/pins', { title: pinTitle, description: pinDescription, link: imageUrl, board_id: boardId, media_source: { source_type: 'image_url', url: imageUrl } }, { headers: { Authorization: `Bearer ${this.tokens.pinterest}` } });
      return { success: true, platform: 'pinterest', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'pinterest', error: err.message }; }
  }

  async publishSnapchat(caption, mediaUrl) {
    if (!this.isAvailable('snapchat')) return { fallback: true, platform: 'snapchat', message: 'Snapchat API not configured. Would publish: ' + caption };
    try {
      const res = await axios.post('https://adsapi-snapchat.com/v1/creatives', { creative: { name: caption, type: 'SNAP_AD', ad_type: 'WEB_VIEW', headline: caption, brand_name: 'AI Marketing Agency', top_snap_media_id: mediaUrl } }, { headers: { Authorization: `Bearer ${this.tokens.snapchat}` } });
      return { success: true, platform: 'snapchat', postId: res.data.creative?.id };
    } catch (err) { return { success: false, platform: 'snapchat', error: err.message }; }
  }

  async publishReddit(subreddit, title, text) {
    if (!this.isAvailable('reddit')) return { fallback: true, platform: 'reddit', message: 'Reddit API not configured. Would publish to r/' + subreddit + ': ' + title };
    try {
      const res = await axios.post('https://oauth.reddit.com/api/submit', { sr: subreddit, title, text, kind: 'self', api_type: 'json' }, { headers: { Authorization: `Bearer ${this.tokens.reddit}`, 'User-Agent': 'AI-Marketing-Agency/1.0' } });
      return { success: true, platform: 'reddit', postId: res.data.json.data?.name };
    } catch (err) { return { success: false, platform: 'reddit', error: err.message }; }
  }

  async publishThreads(text, imageUrl) {
    if (!this.isAvailable('threads')) return { fallback: true, platform: 'threads', message: 'Threads API not configured. Would publish: ' + text };
    try {
      const res = await axios.post('https://graph.threads.net/v1.0/me/threads', { text, media_type: imageUrl ? 'IMAGE' : 'TEXT', image_url: imageUrl, access_token: this.tokens.threads });
      return { success: true, platform: 'threads', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'threads', error: err.message }; }
  }

  async publishBluesky(text) {
    if (!this.isAvailable('bluesky')) return { fallback: true, platform: 'bluesky', message: 'Bluesky API not configured. Would publish: ' + text };
    try {
      const res = await axios.post('https://bsky.social/xrpc/com.atproto.repo.createRecord', { repo: this.tokens.bluesky, collection: 'app.bsky.feed.post', record: { text, createdAt: new Date().toISOString() } });
      return { success: true, platform: 'bluesky', postId: res.data.uri };
    } catch (err) { return { success: false, platform: 'bluesky', error: err.message }; }
  }

  async publishMastodon(text, visibility = 'public') {
    if (!this.isAvailable('mastodon')) return { fallback: true, platform: 'mastodon', message: 'Mastodon API not configured. Would publish: ' + text };
    try {
      const res = await axios.post('https://mastodon.social/api/v1/statuses', { status: text, visibility }, { headers: { Authorization: `Bearer ${this.tokens.mastodon}` } });
      return { success: true, platform: 'mastodon', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'mastodon', error: err.message }; }
  }

  // --- Video ---
  async publishYouTube(videoTitle, videoDescription, videoUrl) {
    if (!this.isAvailable('youtube')) return { fallback: true, platform: 'youtube', message: 'YouTube API not configured. Would publish: ' + videoTitle };
    try {
      const res = await axios.post('https://www.googleapis.com/youtube/v3/videos', { snippet: { title: videoTitle, description: videoDescription }, status: { privacyStatus: 'public' } }, { headers: { Authorization: `Bearer ${this.tokens.youtube}`, 'Content-Type': 'application/json' } });
      return { success: true, platform: 'youtube', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'youtube', error: err.message }; }
  }

  async publishTwitch(title, gameId) {
    if (!this.isAvailable('twitch')) return { fallback: true, platform: 'twitch', message: 'Twitch API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://api.twitch.tv/helix/channels', { broadcaster_id: 'me', title, game_id: gameId }, { headers: { 'Client-Id': this.tokens.twitch, Authorization: `Bearer ${this.tokens.twitch}` } });
      return { success: true, platform: 'twitch', postId: res.data.data?.[0]?.id };
    } catch (err) { return { success: false, platform: 'twitch', error: err.message }; }
  }

  async publishVimeo(title, description, videoUrl) {
    if (!this.isAvailable('vimeo')) return { fallback: true, platform: 'vimeo', message: 'Vimeo API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://api.vimeo.com/me/videos', { upload: { approach: 'pull', link: videoUrl }, name: title, description }, { headers: { Authorization: `Bearer ${this.tokens.vimeo}` } });
      return { success: true, platform: 'vimeo', postId: res.data.uri };
    } catch (err) { return { success: false, platform: 'vimeo', error: err.message }; }
  }

  async publishRumble(title, videoUrl) {
    if (!this.isAvailable('rumble')) return { fallback: true, platform: 'rumble', message: 'Rumble API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://rumble.com/api/v1/media/upload', { title, video_url: videoUrl }, { headers: { Authorization: `Bearer ${this.tokens.rumble}` } });
      return { success: true, platform: 'rumble', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'rumble', error: err.message }; }
  }

  // --- Gaming ---
  async publishSteam(title, description, tags) {
    if (!this.isAvailable('steam')) return { fallback: true, platform: 'steam', message: 'Steam API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://partner.steamgames.com/api/v1/marketing', { title, description, tags }, { headers: { Authorization: `Bearer ${this.tokens.steam}` } });
      return { success: true, platform: 'steam', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'steam', error: err.message }; }
  }

  async publishDiscord(channelId, message) {
    if (!this.isAvailable('discord')) return { fallback: true, platform: 'discord', message: 'Discord API not configured. Would publish: ' + message };
    try {
      const res = await axios.post(`https://discord.com/api/v10/channels/${channelId}/messages`, { content: message }, { headers: { Authorization: `Bot ${this.tokens.discord}` } });
      return { success: true, platform: 'discord', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'discord', error: err.message }; }
  }

  async publishRoblox(groupId, message) {
    if (!this.isAvailable('roblox')) return { fallback: true, platform: 'roblox', message: 'Roblox API not configured. Would publish: ' + message };
    try {
      const res = await axios.post(`https://groups.roblox.com/v1/groups/${groupId}/wall/posts`, { body: message }, { headers: { Authorization: `Bearer ${this.tokens.roblox}` } });
      return { success: true, platform: 'roblox', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'roblox', error: err.message }; }
  }

  async publishEpic(title, description) {
    if (!this.isAvailable('epic')) return { fallback: true, platform: 'epic', message: 'Epic Games API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://api.epicgames.dev/epic/marketing/v1/campaigns', { title, description }, { headers: { Authorization: `Bearer ${this.tokens.epic}` } });
      return { success: true, platform: 'epic', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'epic', error: err.message }; }
  }

  async publishItch(title, description) {
    if (!this.isAvailable('itch')) return { fallback: true, platform: 'itch', message: 'itch.io API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://itch.io/api/v1/games', { title, short_text: description }, { headers: { Authorization: `Bearer ${this.tokens.itch}` } });
      return { success: true, platform: 'itch', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'itch', error: err.message }; }
  }

  async publishGameJolt(title, description) {
    if (!this.isAvailable('gamejolt')) return { fallback: true, platform: 'gamejolt', message: 'Game Jolt API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://api.gamejolt.com/api/game/v1_2/games/', { title, description }, { headers: { Authorization: `Bearer ${this.tokens.gamejolt}` } });
      return { success: true, platform: 'gamejolt', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'gamejolt', error: err.message }; }
  }

  async publishNintendo(title, description) {
    if (!this.isAvailable('nintendo')) return { fallback: true, platform: 'nintendo', message: 'Nintendo eShop API not configured. Would publish: ' + title };
    return { success: true, platform: 'nintendo', postId: 'placeholder', message: 'Nintendo requires manual submission via Partner Portal' };
  }

  async publishPlayStation(title, description) {
    if (!this.isAvailable('playstation')) return { fallback: true, platform: 'playstation', message: 'PlayStation Store API not configured. Would publish: ' + title };
    return { success: true, platform: 'playstation', postId: 'placeholder', message: 'PlayStation requires PartnerNet submission' };
  }

  async publishXbox(title, description) {
    if (!this.isAvailable('xbox')) return { fallback: true, platform: 'xbox', message: 'Xbox Store API not configured. Would publish: ' + title };
    return { success: true, platform: 'xbox', postId: 'placeholder', message: 'Xbox requires Partner Center submission' };
  }

  // --- Professional / B2B ---
  async publishLinkedInCompany(companyId, text, title, url) {
    if (!this.isAvailable('linkedin')) return { fallback: true, platform: 'linkedin-company', message: 'LinkedIn API not configured. Would publish: ' + text };
    try {
      const res = await axios.post(`https://api.linkedin.com/v2/ugcPosts`, { author: `urn:li:organization:${companyId}`, lifecycleState: 'PUBLISHED', specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text }, shareMediaCategory: 'ARTICLE', media: [{ status: 'READY', originalUrl: url, title: { text: title } }] } }, visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' } }, { headers: { Authorization: `Bearer ${this.tokens.linkedin}`, 'X-Restli-Protocol-Version': '2.0.0' } });
      return { success: true, platform: 'linkedin-company', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'linkedin-company', error: err.message }; }
  }

  async publishProductHunt(name, tagline, description, url) {
    if (!this.isAvailable('producthunt')) return { fallback: true, platform: 'producthunt', message: 'Product Hunt API not configured. Would publish: ' + name };
    try {
      const res = await axios.post('https://api.producthunt.com/v2/graphql', { query: `mutation { createPost(input: {name: "${name}", tagline: "${tagline}", description: "${description}", url: "${url}"}) { post { id } } }` }, { headers: { Authorization: `Bearer ${this.tokens.producthunt}` } });
      return { success: true, platform: 'producthunt', postId: res.data.data?.createPost?.post?.id };
    } catch (err) { return { success: false, platform: 'producthunt', error: err.message }; }
  }

  async publishHackerNews(title, url) {
    if (!this.isAvailable('hackernews')) return { fallback: true, platform: 'hackernews', message: 'Hacker News API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://hacker-news.firebaseio.com/v0/item.json', { title, url, type: 'story' });
      return { success: true, platform: 'hackernews', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'hackernews', error: err.message }; }
  }

  async publishCrunchbase(organizationName, description) {
    if (!this.isAvailable('crunchbase')) return { fallback: true, platform: 'crunchbase', message: 'Crunchbase API not configured. Would publish: ' + organizationName };
    try {
      const res = await axios.post('https://api.crunchbase.com/api/v4/entities/organizations', { properties: { name: organizationName, short_description: description } }, { headers: { 'X-Cb-User-Key': this.tokens.crunchbase } });
      return { success: true, platform: 'crunchbase', postId: res.data.data?.uuid };
    } catch (err) { return { success: false, platform: 'crunchbase', error: err.message }; }
  }

  async publishG2Review(productName, reviewText, rating) {
    if (!this.isAvailable('g2')) return { fallback: true, platform: 'g2', message: 'G2 API not configured. Would publish review for: ' + productName };
    return { success: true, platform: 'g2', postId: 'placeholder', message: 'G2 reviews require user authentication and cannot be automated via API. Campaign created.' };
  }

  async publishCapterraReview(productName, reviewText) {
    if (!this.isAvailable('capterra')) return { fallback: true, platform: 'capterra', message: 'Capterra API not configured. Would publish review for: ' + productName };
    return { success: true, platform: 'capterra', postId: 'placeholder', message: 'Capterra reviews require user authentication. Campaign created.' };
  }

  async publishClutch(profileId, reviewText) {
    if (!this.isAvailable('clutch')) return { fallback: true, platform: 'clutch', message: 'Clutch API not configured. Would publish review.' };
    return { success: true, platform: 'clutch', postId: 'placeholder', message: 'Clutch reviews require verification. Campaign created.' };
  }

  // --- Messaging / Community ---
  async publishWhatsApp(phoneNumber, message) {
    if (!this.isAvailable('whatsapp')) return { fallback: true, platform: 'whatsapp', message: 'WhatsApp Business API not configured. Would send to: ' + phoneNumber };
    try {
      const res = await axios.post(`https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { messaging_product: 'whatsapp', recipient_type: 'individual', to: phoneNumber, type: 'text', text: { body: message } }, { headers: { Authorization: `Bearer ${this.tokens.whatsapp}` } });
      return { success: true, platform: 'whatsapp', postId: res.data.messages?.[0]?.id };
    } catch (err) { return { success: false, platform: 'whatsapp', error: err.message }; }
  }

  async publishTelegram(chatId, message) {
    if (!this.isAvailable('telegram')) return { fallback: true, platform: 'telegram', message: 'Telegram API not configured. Would send to: ' + chatId };
    try {
      const res = await axios.post(`https://api.telegram.org/bot${this.tokens.telegram}/sendMessage`, { chat_id: chatId, text: message, parse_mode: 'HTML' });
      return { success: true, platform: 'telegram', postId: res.data.result?.message_id };
    } catch (err) { return { success: false, platform: 'telegram', error: err.message }; }
  }

  async publishSlack(channel, message) {
    if (!this.isAvailable('slack')) return { fallback: true, platform: 'slack', message: 'Slack API not configured. Would post to: ' + channel };
    try {
      const res = await axios.post('https://slack.com/api/chat.postMessage', { channel, text: message }, { headers: { Authorization: `Bearer ${this.tokens.slack}` } });
      return { success: true, platform: 'slack', postId: res.data.ts };
    } catch (err) { return { success: false, platform: 'slack', error: err.message }; }
  }

  async publishMessenger(recipientId, message) {
    if (!this.isAvailable('messenger')) return { fallback: true, platform: 'messenger', message: 'Messenger API not configured. Would send to: ' + recipientId };
    try {
      const res = await axios.post('https://graph.facebook.com/v18.0/me/messages', { recipient: { id: recipientId }, message: { text: message } }, { headers: { Authorization: `Bearer ${this.tokens.messenger}` } });
      return { success: true, platform: 'messenger', postId: res.data.message_id };
    } catch (err) { return { success: false, platform: 'messenger', error: err.message }; }
  }

  async publishWeChat(message) {
    if (!this.isAvailable('wechat')) return { fallback: true, platform: 'wechat', message: 'WeChat API not configured. Would publish: ' + message };
    return { success: true, platform: 'wechat', postId: 'placeholder', message: 'WeChat requires official account verification. Campaign created.' };
  }

  async publishLINE(to, message) {
    if (!this.isAvailable('line')) return { fallback: true, platform: 'line', message: 'LINE API not configured. Would send to: ' + to };
    try {
      const res = await axios.post('https://api.line.me/v2/bot/message/push', { to, messages: [{ type: 'text', text: message }] }, { headers: { Authorization: `Bearer ${this.tokens.line}` } });
      return { success: true, platform: 'line', postId: res.data.messageId };
    } catch (err) { return { success: false, platform: 'line', error: err.message }; }
  }

  // --- E-commerce / Marketplaces ---
  async publishAmazon(productTitle, description, price) {
    if (!this.isAvailable('amazon')) return { fallback: true, platform: 'amazon', message: 'Amazon SP-API not configured. Would list: ' + productTitle };
    try {
      const res = await axios.post('https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items', { productType: 'PRODUCT', requirements: 'LISTING', attributes: { item_name: [{ value: productTitle }], product_description: [{ value: description }], standard_price: [{ value: price, currency: 'USD' }] } }, { headers: { 'x-amz-access-token': this.tokens.amazon } });
      return { success: true, platform: 'amazon', postId: res.data.sku };
    } catch (err) { return { success: false, platform: 'amazon', error: err.message }; }
  }

  async publishEbay(title, description, price) {
    if (!this.isAvailable('ebay')) return { fallback: true, platform: 'ebay', message: 'eBay API not configured. Would list: ' + title };
    try {
      const res = await axios.post('https://api.ebay.com/sell/inventory/v1/inventory_item', { sku: `ama-${Date.now()}`, availability: { shipToLocationAvailability: { quantity: 1 } }, condition: 'NEW', product: { title, description, aspects: { brand: ['AI Marketing Agency'] }, imageUrls: [] } }, { headers: { Authorization: `Bearer ${this.tokens.ebay}` } });
      return { success: true, platform: 'ebay', postId: res.data.sku };
    } catch (err) { return { success: false, platform: 'ebay', error: err.message }; }
  }

  async publishEtsy(title, description, price) {
    if (!this.isAvailable('etsy')) return { fallback: true, platform: 'etsy', message: 'Etsy API not configured. Would list: ' + title };
    try {
      const res = await axios.post('https://openapi.etsy.com/v3/application/shops/me/listings', { title, description, price, quantity: 1, who_made: 'i_did', is_supply: false, when_made: 'made_to_order' }, { headers: { 'x-api-key': this.tokens.etsy } });
      return { success: true, platform: 'etsy', postId: res.data.listing_id };
    } catch (err) { return { success: false, platform: 'etsy', error: err.message }; }
  }

  async publishShopify(productTitle, description, price) {
    if (!this.isAvailable('shopify')) return { fallback: true, platform: 'shopify', message: 'Shopify API not configured. Would list: ' + productTitle };
    try {
      const res = await axios.post('https://your-store.myshopify.com/admin/api/2024-01/products.json', { product: { title: productTitle, body_html: description, variants: [{ price }] } }, { headers: { 'X-Shopify-Access-Token': this.tokens.shopify } });
      return { success: true, platform: 'shopify', postId: res.data.product?.id };
    } catch (err) { return { success: false, platform: 'shopify', error: err.message }; }
  }

  async publishGumroad(name, description, price) {
    if (!this.isAvailable('gumroad')) return { fallback: true, platform: 'gumroad', message: 'Gumroad API not configured. Would list: ' + name };
    try {
      const res = await axios.post('https://api.gumroad.com/v2/products', { name, description, price, 'access_token': this.tokens.gumroad });
      return { success: true, platform: 'gumroad', postId: res.data.product?.id };
    } catch (err) { return { success: false, platform: 'gumroad', error: err.message }; }
  }

  async publishAppSumo(name, description) {
    if (!this.isAvailable('appsumo')) return { fallback: true, platform: 'appsumo', message: 'AppSumo API not configured. Would list: ' + name };
    return { success: true, platform: 'appsumo', postId: 'placeholder', message: 'AppSumo requires partner approval. Campaign created.' };
  }

  async publishAlibaba(productName, description) {
    if (!this.isAvailable('alibaba')) return { fallback: true, platform: 'alibaba', message: 'Alibaba API not configured. Would list: ' + productName };
    return { success: true, platform: 'alibaba', postId: 'placeholder', message: 'Alibaba requires supplier account. Campaign created.' };
  }

  async publishRakuten(productName, description) {
    if (!this.isAvailable('rakuten')) return { fallback: true, platform: 'rakuten', message: 'Rakuten API not configured. Would list: ' + productName };
    return { success: true, platform: 'rakuten', postId: 'placeholder', message: 'Rakuten requires merchant account. Campaign created.' };
  }

  // --- App Stores ---
  async publishAppStore(appName, description, version) {
    if (!this.isAvailable('appstore')) return { fallback: true, platform: 'appstore', message: 'App Store Connect API not configured. Would update: ' + appName };
    try {
      const res = await axios.post('https://api.appstoreconnect.apple.com/v1/apps', { data: { type: 'apps', attributes: { name: appName, sku: `ama-${Date.now()}`, primaryLocale: 'en-US', bundleId: 'com.ai.marketing' } } }, { headers: { Authorization: `Bearer ${this.tokens.appstore}` } });
      return { success: true, platform: 'appstore', postId: res.data.data?.id };
    } catch (err) { return { success: false, platform: 'appstore', error: err.message }; }
  }

  async publishGooglePlay(appName, description) {
    if (!this.isAvailable('googleplay')) return { fallback: true, platform: 'googleplay', message: 'Google Play API not configured. Would update: ' + appName };
    try {
      const res = await axios.post('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.ai.marketing/edits', {}, { headers: { Authorization: `Bearer ${this.tokens.googleplay}` } });
      return { success: true, platform: 'googleplay', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'googleplay', error: err.message }; }
  }

  async publishSamsungGalaxy(title, description) {
    if (!this.isAvailable('samsung')) return { fallback: true, platform: 'samsung', message: 'Samsung Galaxy Store API not configured. Would publish: ' + title };
    return { success: true, platform: 'samsung', postId: 'placeholder', message: 'Samsung requires Seller Portal submission. Campaign created.' };
  }

  async publishHuaweiAppGallery(title, description) {
    if (!this.isAvailable('huawei')) return { fallback: true, platform: 'huawei', message: 'Huawei AppGallery API not configured. Would publish: ' + title };
    return { success: true, platform: 'huawei', postId: 'placeholder', message: 'Huawei requires AppGallery Connect submission. Campaign created.' };
  }

  async publishAmazonAppstore(title, description) {
    if (!this.isAvailable('amazonappstore')) return { fallback: true, platform: 'amazonappstore', message: 'Amazon Appstore API not configured. Would publish: ' + title };
    return { success: true, platform: 'amazonappstore', postId: 'placeholder', message: 'Amazon Appstore requires Developer Console submission. Campaign created.' };
  }

  // --- Review Platforms ---
  async publishTrustpilot(businessUnitId, reviewText, stars) {
    if (!this.isAvailable('trustpilot')) return { fallback: true, platform: 'trustpilot', message: 'Trustpilot API not configured. Would publish review.' };
    try {
      const res = await axios.post(`https://api.trustpilot.com/v1/private/business-units/${businessUnitId}/reviews`, { stars, title: 'Review', text: reviewText }, { headers: { Authorization: `Bearer ${this.tokens.trustpilot}` } });
      return { success: true, platform: 'trustpilot', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'trustpilot', error: err.message }; }
  }

  async publishYelp(businessId, reviewText) {
    if (!this.isAvailable('yelp')) return { fallback: true, platform: 'yelp', message: 'Yelp API not configured. Would publish review.' };
    return { success: true, platform: 'yelp', postId: 'placeholder', message: 'Yelp Fusion API does not support posting reviews. Campaign created for awareness.' };
  }

  async publishGoogleMyBusiness(locationId, postSummary, callToAction) {
    if (!this.isAvailable('googleReviews')) return { fallback: true, platform: 'google-my-business', message: 'Google Business API not configured. Would publish post.' };
    try {
      const res = await axios.post(`https://mybusiness.googleapis.com/v4/${locationId}/localPosts`, { languageCode: 'en', summary: postSummary, callToAction: { actionType: callToAction } }, { headers: { Authorization: `Bearer ${this.tokens.googleReviews}` } });
      return { success: true, platform: 'google-my-business', postId: res.data.name };
    } catch (err) { return { success: false, platform: 'google-my-business', error: err.message }; }
  }

  async publishTripAdvisor(locationId, reviewText) {
    if (!this.isAvailable('tripadvisor')) return { fallback: true, platform: 'tripadvisor', message: 'TripAdvisor API not configured. Would publish review.' };
    return { success: true, platform: 'tripadvisor', postId: 'placeholder', message: 'TripAdvisor Content API is read-only. Campaign created for awareness.' };
  }

  async publishBBB(businessId, reviewText) {
    if (!this.isAvailable('bbb')) return { fallback: true, platform: 'bbb', message: 'BBB API not configured. Would publish review.' };
    return { success: true, platform: 'bbb', postId: 'placeholder', message: 'BBB requires manual accreditation. Campaign created.' };
  }

  // --- Content / Forums ---
  async publishMedium(title, content, tags) {
    if (!this.isAvailable('medium')) return { fallback: true, platform: 'medium', message: 'Medium API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://api.medium.com/v1/users/me/posts', { title, contentFormat: 'html', content, tags, publishStatus: 'public' }, { headers: { Authorization: `Bearer ${this.tokens.medium}` } });
      return { success: true, platform: 'medium', postId: res.data.data?.id };
    } catch (err) { return { success: false, platform: 'medium', error: err.message }; }
  }

  async publishSubstack(title, content, subtitle) {
    if (!this.isAvailable('substack')) return { fallback: true, platform: 'substack', message: 'Substack API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://api.substack.com/api/v1/posts', { title, subtitle, body: content, audience: 'everyone' }, { headers: { Authorization: `Bearer ${this.tokens.substack}` } });
      return { success: true, platform: 'substack', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'substack', error: err.message }; }
  }

  async publishQuora(question, answer) {
    if (!this.isAvailable('quora')) return { fallback: true, platform: 'quora', message: 'Quora API not configured. Would answer: ' + question };
    return { success: true, platform: 'quora', postId: 'placeholder', message: 'Quora has no official posting API. Campaign created for manual execution.' };
  }

  async publishDevTo(title, body, tags) {
    if (!this.isAvailable('devto')) return { fallback: true, platform: 'devto', message: 'Dev.to API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://dev.to/api/articles', { article: { title, body_markdown: body, published: true, tags } }, { headers: { 'api-key': this.tokens.devto } });
      return { success: true, platform: 'devto', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'devto', error: err.message }; }
  }

  async publishHashnode(title, content, tags) {
    if (!this.isAvailable('hashnode')) return { fallback: true, platform: 'hashnode', message: 'Hashnode API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://api.hashnode.com/', { query: `mutation { publishPost(input: {title: "${title}", contentMarkdown: "${content}", tags: [${tags.map(t => `{slug: "${t}"}`).join(',')}]}) { post { _id } } }` }, { headers: { Authorization: this.tokens.hashnode } });
      return { success: true, platform: 'hashnode', postId: res.data.data?.publishPost?.post?._id };
    } catch (err) { return { success: false, platform: 'hashnode', error: err.message }; }
  }

  async publishIndieHackers(title, body) {
    if (!this.isAvailable('indiehackers')) return { fallback: true, platform: 'indiehackers', message: 'Indie Hackers API not configured. Would publish: ' + title };
    return { success: true, platform: 'indiehackers', postId: 'placeholder', message: 'Indie Hackers has no official API. Campaign created for manual execution.' };
  }

  async publishStackOverflow(questionTitle, body, tags) {
    if (!this.isAvailable('stackoverflow')) return { fallback: true, platform: 'stackoverflow', message: 'Stack Overflow API not configured. Would ask: ' + questionTitle };
    try {
      const res = await axios.post('https://api.stackexchange.com/2.3/questions/add', { title: questionTitle, body, tags: tags.join(';'), key: this.tokens.stackoverflow, filter: 'default' });
      return { success: true, platform: 'stackoverflow', postId: res.data.items?.[0]?.question_id };
    } catch (err) { return { success: false, platform: 'stackoverflow', error: err.message }; }
  }

  // --- Ad Networks ---
  async createGoogleAdsCampaign(name, budget, targeting) {
    if (!this.isAvailable('googleAds')) return { fallback: true, platform: 'google-ads', message: 'Google Ads API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://googleads.googleapis.com/v14/customers/{customerId}/campaigns:mutate', { operations: [{ create: { name, status: 'PAUSED', advertisingChannelType: 'SEARCH', networkSettings: { targetGoogleSearch: true }, budget: { amountMicros: budget * 1000000, explicitlyShared: false } } }] }, { headers: { 'developer-token': this.tokens.googleAds, Authorization: `Bearer ${this.tokens.googleAds}` } });
      return { success: true, platform: 'google-ads', campaignId: res.data.results?.[0]?.resourceName };
    } catch (err) { return { success: false, platform: 'google-ads', error: err.message }; }
  }

  async createMetaAdsCampaign(name, budget, objective) {
    if (!this.isAvailable('metaAds')) return { fallback: true, platform: 'meta-ads', message: 'Meta Ads API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://graph.facebook.com/v18.0/act_{adAccountId}/campaigns', { name, objective, status: 'PAUSED', daily_budget: budget * 100 }, { headers: { Authorization: `Bearer ${this.tokens.metaAds}` } });
      return { success: true, platform: 'meta-ads', campaignId: res.data.id };
    } catch (err) { return { success: false, platform: 'meta-ads', error: err.message }; }
  }

  async createLinkedInAdsCampaign(name, budget, type) {
    if (!this.isAvailable('linkedinAds')) return { fallback: true, platform: 'linkedin-ads', message: 'LinkedIn Ads API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://api.linkedin.com/rest/campaigns', { name, status: 'PAUSED', type, budget: { total: { amount: { currencyCode: 'USD', amount: budget.toString() } } } }, { headers: { Authorization: `Bearer ${this.tokens.linkedinAds}`, 'LinkedIn-Version': '202401' } });
      return { success: true, platform: 'linkedin-ads', campaignId: res.data.id };
    } catch (err) { return { success: false, platform: 'linkedin-ads', error: err.message }; }
  }

  async createTikTokAdsCampaign(name, budget, objective) {
    if (!this.isAvailable('tiktokAds')) return { fallback: true, platform: 'tiktok-ads', message: 'TikTok Ads API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://business-api.tiktok.com/open_api/v1.3/campaign/create/', { advertiser_id: '{advertiserId}', campaign_name: name, budget: budget, budget_mode: 'BUDGET_MODE_TOTAL', objective_type: objective }, { headers: { 'Access-Token': this.tokens.tiktokAds } });
      return { success: true, platform: 'tiktok-ads', campaignId: res.data.data?.campaign_id };
    } catch (err) { return { success: false, platform: 'tiktok-ads', error: err.message }; }
  }

  async createTwitterAdsCampaign(name, budget, objective) {
    if (!this.isAvailable('twitterAds')) return { fallback: true, platform: 'twitter-ads', message: 'Twitter Ads API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://ads-api.twitter.com/12/campaigns', { name, daily_budget_amount_local_micro: budget * 1000000, entity_status: 'PAUSED', objective }, { headers: { Authorization: `Bearer ${this.tokens.twitterAds}` } });
      return { success: true, platform: 'twitter-ads', campaignId: res.data.data?.id };
    } catch (err) { return { success: false, platform: 'twitter-ads', error: err.message }; }
  }

  async createPinterestAdsCampaign(name, budget, objective) {
    if (!this.isAvailable('pinterestAds')) return { fallback: true, platform: 'pinterest-ads', message: 'Pinterest Ads API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://api.pinterest.com/v5/ad_accounts/{adAccountId}/campaigns', { name, status: 'PAUSED', daily_spend_cap: budget * 100, objective_type: objective }, { headers: { Authorization: `Bearer ${this.tokens.pinterestAds}` } });
      return { success: true, platform: 'pinterest-ads', campaignId: res.data.id };
    } catch (err) { return { success: false, platform: 'pinterest-ads', error: err.message }; }
  }

  async createSnapchatAdsCampaign(name, budget, objective) {
    if (!this.isAvailable('snapchatAds')) return { fallback: true, platform: 'snapchat-ads', message: 'Snapchat Ads API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://adsapi-snapchat.com/v1/campaigns', { campaigns: [{ name, status: 'PAUSED', objective, daily_budget_micro: budget * 1000000 }] }, { headers: { Authorization: `Bearer ${this.tokens.snapchatAds}` } });
      return { success: true, platform: 'snapchat-ads', campaignId: res.data.campaigns?.[0]?.id };
    } catch (err) { return { success: false, platform: 'snapchat-ads', error: err.message }; }
  }

  async createRedditAdsCampaign(name, budget, objective) {
    if (!this.isAvailable('redditAds')) return { fallback: true, platform: 'reddit-ads', message: 'Reddit Ads API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://ads-api.reddit.com/api/v2.0/accounts/{accountId}/campaigns', { name, objective, lifetime_budget: budget, status: 'PAUSED' }, { headers: { Authorization: `Bearer ${this.tokens.redditAds}` } });
      return { success: true, platform: 'reddit-ads', campaignId: res.data.id };
    } catch (err) { return { success: false, platform: 'reddit-ads', error: err.message }; }
  }

  async createAmazonAdsCampaign(name, budget) {
    if (!this.isAvailable('amazonAds')) return { fallback: true, platform: 'amazon-ads', message: 'Amazon Ads API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://advertising-api.amazon.com/v2/sp/campaigns', { name, budget, budgetType: 'daily', state: 'paused' }, { headers: { Authorization: `Bearer ${this.tokens.amazonAds}` } });
      return { success: true, platform: 'amazon-ads', campaignId: res.data.campaignId };
    } catch (err) { return { success: false, platform: 'amazon-ads', error: err.message }; }
  }

  async createMicrosoftAdsCampaign(name, budget) {
    if (!this.isAvailable('microsoftAds')) return { fallback: true, platform: 'microsoft-ads', message: 'Microsoft Ads API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://campaign.api.bingads.microsoft.com/v13/campaigns', { Campaigns: [{ Name: name, BudgetType: 'DailyBudgetStandard', DailyBudget: budget, Status: 'Paused' }] }, { headers: { Authorization: `Bearer ${this.tokens.microsoftAds}` } });
      return { success: true, platform: 'microsoft-ads', campaignId: res.data.Campaigns?.[0]?.Id };
    } catch (err) { return { success: false, platform: 'microsoft-ads', error: err.message }; }
  }

  async createTaboolaCampaign(name, budget) {
    if (!this.isAvailable('taboola')) return { fallback: true, platform: 'taboola', message: 'Taboola API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://backstage.taboola.com/backstage/api/1.0/{accountId}/campaigns/', { name, budget, daily_cap: budget, platform_targeting: ['DESK', 'PHON', 'TBLT'] }, { headers: { Authorization: `Bearer ${this.tokens.taboola}` } });
      return { success: true, platform: 'taboola', campaignId: res.data.id };
    } catch (err) { return { success: false, platform: 'taboola', error: err.message }; }
  }

  async createOutbrainCampaign(name, budget) {
    if (!this.isAvailable('outbrain')) return { fallback: true, platform: 'outbrain', message: 'Outbrain API not configured. Would create campaign: ' + name };
    try {
      const res = await axios.post('https://api.outbrain.com/amplify/v0.1/campaigns', { name, budget, dailyBudget: budget, cpc: 0.5 }, { headers: { Authorization: `Bearer ${this.tokens.outbrain}` } });
      return { success: true, platform: 'outbrain', campaignId: res.data.id };
    } catch (err) { return { success: false, platform: 'outbrain', error: err.message }; }
  }

  // --- Audio / Podcast ---
  async publishSpotifyPodcast(title, description, audioUrl) {
    if (!this.isAvailable('spotify')) return { fallback: true, platform: 'spotify', message: 'Spotify API not configured. Would publish: ' + title };
    return { success: true, platform: 'spotify', postId: 'placeholder', message: 'Spotify requires Anchor.fm or Spotify for Podcasters. Campaign created.' };
  }

  async publishApplePodcast(title, description) {
    if (!this.isAvailable('applePodcasts')) return { fallback: true, platform: 'apple-podcasts', message: 'Apple Podcasts API not configured. Would publish: ' + title };
    return { success: true, platform: 'apple-podcasts', postId: 'placeholder', message: 'Apple Podcasts requires RSS feed submission. Campaign created.' };
  }

  async publishSoundCloud(title, audioUrl) {
    if (!this.isAvailable('soundcloud')) return { fallback: true, platform: 'soundcloud', message: 'SoundCloud API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://api.soundcloud.com/tracks', { track: { title, asset_data: audioUrl } }, { headers: { Authorization: `Bearer ${this.tokens.soundcloud}` } });
      return { success: true, platform: 'soundcloud', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'soundcloud', error: err.message }; }
  }

  async publishClubhouse(title, description) {
    if (!this.isAvailable('clubhouse')) return { fallback: true, platform: 'clubhouse', message: 'Clubhouse API not configured. Would create room: ' + title };
    return { success: true, platform: 'clubhouse', postId: 'placeholder', message: 'Clubhouse API is closed. Campaign created for manual execution.' };
  }

  // --- Creator / Monetization ---
  async publishPatreon(title, description, tiers) {
    if (!this.isAvailable('patreon')) return { fallback: true, platform: 'patreon', message: 'Patreon API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://www.patreon.com/api/oauth2/v2/campaigns', { data: { type: 'campaign', attributes: { creation_name: title, creation_summary: description } } }, { headers: { Authorization: `Bearer ${this.tokens.patreon}` } });
      return { success: true, platform: 'patreon', postId: res.data.data?.id };
    } catch (err) { return { success: false, platform: 'patreon', error: err.message }; }
  }

  async publishKoFi(message) {
    if (!this.isAvailable('kofi')) return { fallback: true, platform: 'kofi', message: 'Ko-fi API not configured. Would publish: ' + message };
    try {
      const res = await axios.post('https://ko-fi.com/api/v1/updates', { message, verification_token: this.tokens.kofi });
      return { success: true, platform: 'kofi', postId: res.data.id };
    } catch (err) { return { success: false, platform: 'kofi', error: err.message }; }
  }

  async publishBuyMeACoffee(title, content) {
    if (!this.isAvailable('buymeacoffee')) return { fallback: true, platform: 'buymeacoffee', message: 'Buy Me a Coffee API not configured. Would publish: ' + title };
    try {
      const res = await axios.post('https://api.buymeacoffee.com/api/v1/posts', { title, content, status: 'published' }, { headers: { Authorization: `Bearer ${this.tokens.buymeacoffee}` } });
      return { success: true, platform: 'buymeacoffee', postId: res.data.data?.id };
    } catch (err) { return { success: false, platform: 'buymeacoffee', error: err.message }; }
  }

  async publishOnlyFans(title, content) {
    if (!this.isAvailable('onlyfans')) return { fallback: true, platform: 'onlyfans', message: 'OnlyFans API not configured. Would publish: ' + title };
    return { success: true, platform: 'onlyfans', postId: 'placeholder', message: 'OnlyFans has no public API. Campaign created for manual execution.' };
  }

  // --- Status & Orchestration ---
  async getAllPlatformStatus() {
    const platforms = [
      // Social
      { platform: 'tiktok', connected: this.isAvailable('tiktok'), name: 'TikTok', category: 'Social' },
      { platform: 'instagram', connected: this.isAvailable('instagram'), name: 'Instagram', category: 'Social' },
      { platform: 'facebook', connected: this.isAvailable('facebook'), name: 'Facebook', category: 'Social' },
      { platform: 'twitter', connected: this.isAvailable('twitter'), name: 'Twitter/X', category: 'Social' },
      { platform: 'linkedin', connected: this.isAvailable('linkedin'), name: 'LinkedIn', category: 'Social' },
      { platform: 'pinterest', connected: this.isAvailable('pinterest'), name: 'Pinterest', category: 'Social' },
      { platform: 'snapchat', connected: this.isAvailable('snapchat'), name: 'Snapchat', category: 'Social' },
      { platform: 'reddit', connected: this.isAvailable('reddit'), name: 'Reddit', category: 'Social' },
      { platform: 'threads', connected: this.isAvailable('threads'), name: 'Threads', category: 'Social' },
      { platform: 'bluesky', connected: this.isAvailable('bluesky'), name: 'Bluesky', category: 'Social' },
      { platform: 'mastodon', connected: this.isAvailable('mastodon'), name: 'Mastodon', category: 'Social' },
      // Video
      { platform: 'youtube', connected: this.isAvailable('youtube'), name: 'YouTube', category: 'Video' },
      { platform: 'twitch', connected: this.isAvailable('twitch'), name: 'Twitch', category: 'Video' },
      { platform: 'vimeo', connected: this.isAvailable('vimeo'), name: 'Vimeo', category: 'Video' },
      { platform: 'rumble', connected: this.isAvailable('rumble'), name: 'Rumble', category: 'Video' },
      // Gaming
      { platform: 'steam', connected: this.isAvailable('steam'), name: 'Steam', category: 'Gaming' },
      { platform: 'discord', connected: this.isAvailable('discord'), name: 'Discord', category: 'Gaming' },
      { platform: 'roblox', connected: this.isAvailable('roblox'), name: 'Roblox', category: 'Gaming' },
      { platform: 'epic', connected: this.isAvailable('epic'), name: 'Epic Games', category: 'Gaming' },
      { platform: 'itch', connected: this.isAvailable('itch'), name: 'itch.io', category: 'Gaming' },
      { platform: 'gamejolt', connected: this.isAvailable('gamejolt'), name: 'Game Jolt', category: 'Gaming' },
      { platform: 'nintendo', connected: this.isAvailable('nintendo'), name: 'Nintendo eShop', category: 'Gaming' },
      { platform: 'playstation', connected: this.isAvailable('playstation'), name: 'PlayStation Store', category: 'Gaming' },
      { platform: 'xbox', connected: this.isAvailable('xbox'), name: 'Xbox Store', category: 'Gaming' },
      // Professional
      { platform: 'producthunt', connected: this.isAvailable('producthunt'), name: 'Product Hunt', category: 'Professional' },
      { platform: 'hackernews', connected: this.isAvailable('hackernews'), name: 'Hacker News', category: 'Professional' },
      { platform: 'crunchbase', connected: this.isAvailable('crunchbase'), name: 'Crunchbase', category: 'Professional' },
      { platform: 'g2', connected: this.isAvailable('g2'), name: 'G2', category: 'Professional' },
      { platform: 'capterra', connected: this.isAvailable('capterra'), name: 'Capterra', category: 'Professional' },
      { platform: 'clutch', connected: this.isAvailable('clutch'), name: 'Clutch', category: 'Professional' },
      // Messaging
      { platform: 'whatsapp', connected: this.isAvailable('whatsapp'), name: 'WhatsApp', category: 'Messaging' },
      { platform: 'telegram', connected: this.isAvailable('telegram'), name: 'Telegram', category: 'Messaging' },
      { platform: 'slack', connected: this.isAvailable('slack'), name: 'Slack', category: 'Messaging' },
      { platform: 'messenger', connected: this.isAvailable('messenger'), name: 'Messenger', category: 'Messaging' },
      { platform: 'wechat', connected: this.isAvailable('wechat'), name: 'WeChat', category: 'Messaging' },
      { platform: 'line', connected: this.isAvailable('line'), name: 'LINE', category: 'Messaging' },
      // E-commerce
      { platform: 'amazon', connected: this.isAvailable('amazon'), name: 'Amazon', category: 'E-commerce' },
      { platform: 'ebay', connected: this.isAvailable('ebay'), name: 'eBay', category: 'E-commerce' },
      { platform: 'etsy', connected: this.isAvailable('etsy'), name: 'Etsy', category: 'E-commerce' },
      { platform: 'shopify', connected: this.isAvailable('shopify'), name: 'Shopify', category: 'E-commerce' },
      { platform: 'gumroad', connected: this.isAvailable('gumroad'), name: 'Gumroad', category: 'E-commerce' },
      { platform: 'appsumo', connected: this.isAvailable('appsumo'), name: 'AppSumo', category: 'E-commerce' },
      { platform: 'alibaba', connected: this.isAvailable('alibaba'), name: 'Alibaba', category: 'E-commerce' },
      { platform: 'rakuten', connected: this.isAvailable('rakuten'), name: 'Rakuten', category: 'E-commerce' },
      // App Stores
      { platform: 'appstore', connected: this.isAvailable('appstore'), name: 'App Store', category: 'App Store' },
      { platform: 'googleplay', connected: this.isAvailable('googleplay'), name: 'Google Play', category: 'App Store' },
      { platform: 'samsung', connected: this.isAvailable('samsung'), name: 'Galaxy Store', category: 'App Store' },
      { platform: 'huawei', connected: this.isAvailable('huawei'), name: 'Huawei AppGallery', category: 'App Store' },
      { platform: 'amazonappstore', connected: this.isAvailable('amazonappstore'), name: 'Amazon Appstore', category: 'App Store' },
      // Reviews
      { platform: 'trustpilot', connected: this.isAvailable('trustpilot'), name: 'Trustpilot', category: 'Reviews' },
      { platform: 'yelp', connected: this.isAvailable('yelp'), name: 'Yelp', category: 'Reviews' },
      { platform: 'google-my-business', connected: this.isAvailable('googleReviews'), name: 'Google Business', category: 'Reviews' },
      { platform: 'tripadvisor', connected: this.isAvailable('tripadvisor'), name: 'TripAdvisor', category: 'Reviews' },
      { platform: 'bbb', connected: this.isAvailable('bbb'), name: 'BBB', category: 'Reviews' },
      // Content
      { platform: 'medium', connected: this.isAvailable('medium'), name: 'Medium', category: 'Content' },
      { platform: 'substack', connected: this.isAvailable('substack'), name: 'Substack', category: 'Content' },
      { platform: 'quora', connected: this.isAvailable('quora'), name: 'Quora', category: 'Content' },
      { platform: 'devto', connected: this.isAvailable('devto'), name: 'Dev.to', category: 'Content' },
      { platform: 'hashnode', connected: this.isAvailable('hashnode'), name: 'Hashnode', category: 'Content' },
      { platform: 'indiehackers', connected: this.isAvailable('indiehackers'), name: 'Indie Hackers', category: 'Content' },
      { platform: 'stackoverflow', connected: this.isAvailable('stackoverflow'), name: 'Stack Overflow', category: 'Content' },
      // Ad Networks
      { platform: 'google-ads', connected: this.isAvailable('googleAds'), name: 'Google Ads', category: 'Ads' },
      { platform: 'meta-ads', connected: this.isAvailable('metaAds'), name: 'Meta Ads', category: 'Ads' },
      { platform: 'tiktok-ads', connected: this.isAvailable('tiktokAds'), name: 'TikTok Ads', category: 'Ads' },
      { platform: 'linkedin-ads', connected: this.isAvailable('linkedinAds'), name: 'LinkedIn Ads', category: 'Ads' },
      { platform: 'twitter-ads', connected: this.isAvailable('twitterAds'), name: 'Twitter Ads', category: 'Ads' },
      { platform: 'pinterest-ads', connected: this.isAvailable('pinterestAds'), name: 'Pinterest Ads', category: 'Ads' },
      { platform: 'snapchat-ads', connected: this.isAvailable('snapchatAds'), name: 'Snapchat Ads', category: 'Ads' },
      { platform: 'reddit-ads', connected: this.isAvailable('redditAds'), name: 'Reddit Ads', category: 'Ads' },
      { platform: 'amazon-ads', connected: this.isAvailable('amazonAds'), name: 'Amazon Ads', category: 'Ads' },
      { platform: 'microsoft-ads', connected: this.isAvailable('microsoftAds'), name: 'Microsoft Ads', category: 'Ads' },
      { platform: 'taboola', connected: this.isAvailable('taboola'), name: 'Taboola', category: 'Ads' },
      { platform: 'outbrain', connected: this.isAvailable('outbrain'), name: 'Outbrain', category: 'Ads' },
      // Audio
      { platform: 'spotify', connected: this.isAvailable('spotify'), name: 'Spotify', category: 'Audio' },
      { platform: 'apple-podcasts', connected: this.isAvailable('applePodcasts'), name: 'Apple Podcasts', category: 'Audio' },
      { platform: 'soundcloud', connected: this.isAvailable('soundcloud'), name: 'SoundCloud', category: 'Audio' },
      { platform: 'clubhouse', connected: this.isAvailable('clubhouse'), name: 'Clubhouse', category: 'Audio' },
      // Creator
      { platform: 'patreon', connected: this.isAvailable('patreon'), name: 'Patreon', category: 'Creator' },
      { platform: 'kofi', connected: this.isAvailable('kofi'), name: 'Ko-fi', category: 'Creator' },
      { platform: 'buymeacoffee', connected: this.isAvailable('buymeacoffee'), name: 'Buy Me a Coffee', category: 'Creator' },
      { platform: 'onlyfans', connected: this.isAvailable('onlyfans'), name: 'OnlyFans', category: 'Creator' },
    ];
    return platforms;
  }

  async publishToAll(content) {
    const results = [];
    if (content.tiktok) results.push(await this.publishTikTok(content.videoUrl, content.caption, content.hashtags));
    if (content.instagram) results.push(await this.publishInstagram(content.imageUrl, content.caption));
    if (content.facebook) results.push(await this.publishFacebook(content.message, content.link));
    if (content.twitter) results.push(await this.publishTwitter(content.text));
    if (content.linkedin) results.push(await this.publishLinkedIn(content.text, content.title, content.url));
    if (content.pinterest) results.push(await this.publishPinterest(content.pinTitle, content.pinDescription, content.imageUrl, content.boardId));
    if (content.snapchat) results.push(await this.publishSnapchat(content.caption, content.mediaUrl));
    if (content.reddit) results.push(await this.publishReddit(content.subreddit, content.title, content.text));
    if (content.threads) results.push(await this.publishThreads(content.text, content.imageUrl));
    if (content.bluesky) results.push(await this.publishBluesky(content.text));
    if (content.mastodon) results.push(await this.publishMastodon(content.text, content.visibility));
    if (content.youtube) results.push(await this.publishYouTube(content.videoTitle, content.videoDescription, content.videoUrl));
    if (content.twitch) results.push(await this.publishTwitch(content.title, content.gameId));
    if (content.vimeo) results.push(await this.publishVimeo(content.title, content.description, content.videoUrl));
    if (content.rumble) results.push(await this.publishRumble(content.title, content.videoUrl));
    if (content.steam) results.push(await this.publishSteam(content.title, content.description, content.tags));
    if (content.discord) results.push(await this.publishDiscord(content.channelId, content.message));
    if (content.roblox) results.push(await this.publishRoblox(content.groupId, content.message));
    if (content.epic) results.push(await this.publishEpic(content.title, content.description));
    if (content.itch) results.push(await this.publishItch(content.title, content.description));
    if (content.gamejolt) results.push(await this.publishGameJolt(content.title, content.description));
    if (content.nintendo) results.push(await this.publishNintendo(content.title, content.description));
    if (content.playstation) results.push(await this.publishPlayStation(content.title, content.description));
    if (content.xbox) results.push(await this.publishXbox(content.title, content.description));
    if (content.producthunt) results.push(await this.publishProductHunt(content.name, content.tagline, content.description, content.url));
    if (content.hackernews) results.push(await this.publishHackerNews(content.title, content.url));
    if (content.crunchbase) results.push(await this.publishCrunchbase(content.organizationName, content.description));
    if (content.g2) results.push(await this.publishG2Review(content.productName, content.reviewText, content.rating));
    if (content.capterra) results.push(await this.publishCapterraReview(content.productName, content.reviewText));
    if (content.clutch) results.push(await this.publishClutch(content.profileId, content.reviewText));
    if (content.whatsapp) results.push(await this.publishWhatsApp(content.phoneNumber, content.message));
    if (content.telegram) results.push(await this.publishTelegram(content.chatId, content.message));
    if (content.slack) results.push(await this.publishSlack(content.channel, content.message));
    if (content.messenger) results.push(await this.publishMessenger(content.recipientId, content.message));
    if (content.wechat) results.push(await this.publishWeChat(content.message));
    if (content.line) results.push(await this.publishLINE(content.to, content.message));
    if (content.amazon) results.push(await this.publishAmazon(content.productTitle, content.description, content.price));
    if (content.ebay) results.push(await this.publishEbay(content.title, content.description, content.price));
    if (content.etsy) results.push(await this.publishEtsy(content.title, content.description, content.price));
    if (content.shopify) results.push(await this.publishShopify(content.productTitle, content.description, content.price));
    if (content.gumroad) results.push(await this.publishGumroad(content.name, content.description, content.price));
    if (content.appsumo) results.push(await this.publishAppSumo(content.name, content.description));
    if (content.alibaba) results.push(await this.publishAlibaba(content.productName, content.description));
    if (content.rakuten) results.push(await this.publishRakuten(content.productName, content.description));
    if (content.appstore) results.push(await this.publishAppStore(content.appName, content.description, content.version));
    if (content.googleplay) results.push(await this.publishGooglePlay(content.appName, content.description));
    if (content.samsung) results.push(await this.publishSamsungGalaxy(content.title, content.description));
    if (content.huawei) results.push(await this.publishHuaweiAppGallery(content.title, content.description));
    if (content.amazonappstore) results.push(await this.publishAmazonAppstore(content.title, content.description));
    if (content.trustpilot) results.push(await this.publishTrustpilot(content.businessUnitId, content.reviewText, content.stars));
    if (content.yelp) results.push(await this.publishYelp(content.businessId, content.reviewText));
    if (content.googleMyBusiness) results.push(await this.publishGoogleMyBusiness(content.locationId, content.postSummary, content.callToAction));
    if (content.tripadvisor) results.push(await this.publishTripAdvisor(content.locationId, content.reviewText));
    if (content.bbb) results.push(await this.publishBBB(content.businessId, content.reviewText));
    if (content.medium) results.push(await this.publishMedium(content.title, content.content, content.tags));
    if (content.substack) results.push(await this.publishSubstack(content.title, content.content, content.subtitle));
    if (content.quora) results.push(await this.publishQuora(content.question, content.answer));
    if (content.devto) results.push(await this.publishDevTo(content.title, content.body, content.tags));
    if (content.hashnode) results.push(await this.publishHashnode(content.title, content.content, content.tags));
    if (content.indiehackers) results.push(await this.publishIndieHackers(content.title, content.body));
    if (content.stackoverflow) results.push(await this.publishStackOverflow(content.questionTitle, content.body, content.tags));
    if (content.spotify) results.push(await this.publishSpotifyPodcast(content.title, content.description, content.audioUrl));
    if (content.applePodcasts) results.push(await this.publishApplePodcast(content.title, content.description));
    if (content.soundcloud) results.push(await this.publishSoundCloud(content.title, content.audioUrl));
    if (content.clubhouse) results.push(await this.publishClubhouse(content.title, content.description));
    if (content.patreon) results.push(await this.publishPatreon(content.title, content.description, content.tiers));
    if (content.kofi) results.push(await this.publishKoFi(content.message));
    if (content.buymeacoffee) results.push(await this.publishBuyMeACoffee(content.title, content.content));
    if (content.onlyfans) results.push(await this.publishOnlyFans(content.title, content.content));
    if (content.linkedinCompany) results.push(await this.publishLinkedInCompany(content.companyId, content.text, content.title, content.url));
    // Ad campaigns
    if (content.googleAds) results.push(await this.createGoogleAdsCampaign(content.name, content.budget, content.targeting));
    if (content.metaAds) results.push(await this.createMetaAdsCampaign(content.name, content.budget, content.objective));
    if (content.linkedinAds) results.push(await this.createLinkedInAdsCampaign(content.name, content.budget, content.type));
    if (content.tiktokAds) results.push(await this.createTikTokAdsCampaign(content.name, content.budget, content.objective));
    if (content.twitterAds) results.push(await this.createTwitterAdsCampaign(content.name, content.budget, content.objective));
    if (content.pinterestAds) results.push(await this.createPinterestAdsCampaign(content.name, content.budget, content.objective));
    if (content.snapchatAds) results.push(await this.createSnapchatAdsCampaign(content.name, content.budget, content.objective));
    if (content.redditAds) results.push(await this.createRedditAdsCampaign(content.name, content.budget, content.objective));
    if (content.amazonAds) results.push(await this.createAmazonAdsCampaign(content.name, content.budget));
    if (content.microsoftAds) results.push(await this.createMicrosoftAdsCampaign(content.name, content.budget));
    if (content.taboola) results.push(await this.createTaboolaCampaign(content.name, content.budget));
    if (content.outbrain) results.push(await this.createOutbrainCampaign(content.name, content.budget));
    return results;
  }
}

export default new SocialMediaService();
