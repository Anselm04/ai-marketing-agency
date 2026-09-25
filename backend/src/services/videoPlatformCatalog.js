/**
 * Social/video platform capability catalog.
 *
 * "direct_api" means this application has (or can have) an official third-party
 * publishing integration using the user's authorized account.
 * Other statuses are still surfaced to users, but are never presented as an
 * automated upload when the platform does not expose that capability.
 */
export const videoPlatformCatalog = [
  { id: 'facebook', name: 'Facebook', category: 'major', connectorId: 'meta_facebook', access: 'business_or_page_oauth', publish: 'direct_api', formats: ['reels', 'video'] },
  { id: 'youtube', name: 'YouTube', category: 'major', connectorId: 'youtube', access: 'user_oauth', publish: 'direct_api', formats: ['shorts', 'video'] },
  { id: 'instagram', name: 'Instagram', category: 'major', connectorId: 'meta_instagram', access: 'professional_account_oauth', publish: 'direct_api', formats: ['reels'] },
  { id: 'tiktok', name: 'TikTok', category: 'major', connectorId: 'tiktok', access: 'user_oauth', publish: 'direct_api', formats: ['video'] },
  { id: 'whatsapp', name: 'WhatsApp', category: 'major', connectorId: 'whatsapp_business', access: 'business_api', publish: 'messaging_only', formats: ['chat_video'], note: 'Cloud API sends video messages; it is not a general personal Status uploader.' },
  { id: 'snapchat', name: 'Snapchat', category: 'major', connectorId: 'snapchat', access: 'app_oauth', publish: 'restricted_api', formats: ['spotlight', 'story'], note: 'Organic/public publishing access depends on Snap product approval; do not assume arbitrary account upload.' },
  { id: 'x', name: 'X', category: 'major', connectorId: 'twitter_x', access: 'user_oauth', publish: 'adapter_pending', formats: ['video'] },
  { id: 'threads', name: 'Threads', category: 'major', connectorId: 'threads', access: 'user_oauth', publish: 'direct_api', formats: ['video'] },
  { id: 'reddit', name: 'Reddit', category: 'major', connectorId: 'reddit', access: 'user_oauth', publish: 'restricted_api', formats: ['post'], note: 'Classic third-party API does not provide a simple arbitrary native-video upload equivalent for every app.' },
  { id: 'pinterest', name: 'Pinterest', category: 'major', connectorId: 'pinterest', access: 'user_oauth', publish: 'direct_api', formats: ['video_pin'] },
  { id: 'linkedin', name: 'LinkedIn', category: 'major', connectorId: 'linkedin', access: 'user_oauth', publish: 'direct_api', formats: ['video_post'] },
  { id: 'telegram', name: 'Telegram', category: 'major', connectorId: 'telegram', access: 'bot_or_business_connection', publish: 'messaging_only', formats: ['channel_video', 'chat_video'], note: 'Bot API publishing is not the same as signing in and posting as a personal user account.' },
  { id: 'discord', name: 'Discord', category: 'major', connectorId: 'discord', access: 'bot_or_app_oauth', publish: 'messaging_only', formats: ['channel_attachment'], note: 'Apps/bots can upload files to channels; they do not impersonate the user.' },

  { id: 'clapper', name: 'Clapper', category: 'short_form', access: 'none', publish: 'no_public_upload_api', formats: ['video'] },
  { id: 'whistlr', name: 'Whistlr', category: 'short_form', access: 'none', publish: 'no_public_upload_api', formats: ['video'] },
  { id: 'bluesky', name: 'Bluesky', category: 'short_form', connectorId: 'bluesky', access: 'atproto_oauth', publish: 'adapter_pending', formats: ['video'] },
  { id: 'loops', name: 'Loops by Pixelfed', category: 'short_form', access: 'federated', publish: 'adapter_pending', formats: ['video'] },
  { id: 'divine', name: 'diVine', category: 'short_form', access: 'nostr', publish: 'adapter_pending', formats: ['video'] },
  { id: 'coub', name: 'Coub', category: 'short_form', access: 'platform_specific', publish: 'no_verified_public_upload_api', formats: ['video_loop'] },
  { id: 'rednote', name: 'RedNote / Xiaohongshu', category: 'short_form', access: 'platform_specific', publish: 'restricted_api', formats: ['video'] },
  { id: 'upscrolled', name: 'UpScrolled', category: 'short_form', access: 'none', publish: 'no_public_upload_api', formats: ['video'] },

  { id: 'twitch', name: 'Twitch', category: 'live', connectorId: 'twitch', access: 'user_oauth', publish: 'stream_or_vod_tools', formats: ['live', 'clips'], note: 'Twitch API is primarily stream/VOD/clip management, not a general arbitrary-video uploader.' },
  { id: 'kick', name: 'Kick', category: 'live', access: 'stream_credentials', publish: 'stream_only', formats: ['live'] },
  { id: 'trovo', name: 'Trovo', category: 'live', access: 'stream_credentials', publish: 'stream_only', formats: ['live'] },
  { id: 'bigo_live', name: 'BIGO LIVE', category: 'live', access: 'platform_specific', publish: 'stream_only', formats: ['live'] },
  { id: 'amazon_live', name: 'Amazon Live', category: 'live', access: 'creator_program', publish: 'restricted_api', formats: ['live'] },
  { id: 'bilibili', name: 'Bilibili', category: 'live', access: 'regional_platform', publish: 'restricted_api', formats: ['video', 'live'] },
  { id: 'dailymotion', name: 'Dailymotion', category: 'live', connectorId: 'dailymotion', access: 'user_oauth', publish: 'direct_api', formats: ['video'] },
  { id: 'rumble', name: 'Rumble', category: 'live', access: 'platform_specific', publish: 'no_verified_public_upload_api', formats: ['video', 'live'] },
  { id: 'kakaotv', name: 'KakaoTV', category: 'live', access: 'regional_platform', publish: 'restricted_api', formats: ['video', 'live'] },
  { id: 'naver_tv', name: 'Naver TV', category: 'live', access: 'regional_platform', publish: 'restricted_api', formats: ['video', 'live'] },

  { id: 'line', name: 'LINE', category: 'messaging', connectorId: 'line', access: 'official_account_api', publish: 'messaging_only', formats: ['chat_video'] },
  { id: 'kakaotalk', name: 'KakaoTalk', category: 'messaging', access: 'business_api', publish: 'messaging_only', formats: ['chat_video'] },
  { id: 'vk', name: 'VK', category: 'messaging', access: 'user_oauth', publish: 'adapter_pending', formats: ['video'] },

  { id: 'patreon', name: 'Patreon', category: 'niche', connectorId: 'patreon', access: 'creator_oauth', publish: 'restricted_api', formats: ['member_video'] },
  { id: 'substack', name: 'Substack', category: 'niche', connectorId: 'substack', access: 'none', publish: 'no_public_publish_api', formats: ['video_post'] },
  { id: 'strava', name: 'Strava', category: 'niche', access: 'user_oauth', publish: 'no_public_video_upload_api', formats: ['activity_media'] },
  { id: 'letterboxd', name: 'Letterboxd', category: 'niche', access: 'none', publish: 'no_public_video_upload_api', formats: [] },
  { id: 'nextdoor', name: 'Nextdoor', category: 'niche', access: 'restricted_partner_api', publish: 'restricted_api', formats: ['video_post'] },
  { id: 'fizz', name: 'Fizz', category: 'niche', access: 'none', publish: 'no_public_upload_api', formats: ['video'] },

  { id: 'douyin', name: 'Douyin', category: 'regional', access: 'regional_developer_api', publish: 'restricted_api', formats: ['video'] },
  { id: 'kuaishou', name: 'Kuaishou', category: 'regional', access: 'regional_developer_api', publish: 'restricted_api', formats: ['video'] },
  { id: 'weibo', name: 'Sina Weibo', category: 'regional', access: 'regional_developer_api', publish: 'adapter_pending', formats: ['video'] },
  { id: 'vk_video', name: 'VK Video', category: 'regional', access: 'user_oauth', publish: 'adapter_pending', formats: ['video'] },
  { id: 'rutube', name: 'Rutube', category: 'regional', access: 'regional_platform', publish: 'restricted_api', formats: ['video'] },

  { id: 'mastodon', name: 'Mastodon', category: 'decentralized', access: 'instance_oauth', publish: 'adapter_pending', formats: ['video'] },
  { id: 'lemmy', name: 'Lemmy', category: 'decentralized', access: 'instance_auth', publish: 'link_or_instance_specific', formats: ['post'] },
  { id: 'warpcast', name: 'Warpcast / Farcaster', category: 'decentralized', access: 'farcaster_auth', publish: 'adapter_pending', formats: ['video_embed'] },
  { id: 'skylight', name: 'Skylight Social', category: 'decentralized', access: 'platform_specific', publish: 'adapter_pending', formats: ['video'] },
  { id: 'bluescreen', name: 'Bluescreen', category: 'decentralized', access: 'atproto_oauth', publish: 'adapter_pending', formats: ['video'] },
  { id: 'reelo', name: 'Reelo', category: 'decentralized', access: 'atproto_oauth', publish: 'adapter_pending', formats: ['video'] },
];

export const directVideoPlatformIds = new Set(
  videoPlatformCatalog.filter((platform) => platform.publish === 'direct_api').map((platform) => platform.id),
);

export function getVideoPlatform(id) {
  return videoPlatformCatalog.find((platform) => platform.id === id) || null;
}
