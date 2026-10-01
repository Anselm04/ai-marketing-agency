export const ORGANIC_NETWORKS = [
  { id: 'youtube', name: 'YouTube' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'x', name: 'X' },
  { id: 'reddit', name: 'Reddit' },
  { id: 'pinterest', name: 'Pinterest' },
  { id: 'threads', name: 'Threads' },
  { id: 'snapchat', name: 'Snapchat' },
  { id: 'github', name: 'GitHub' },
  { id: 'producthunt', name: 'Product Hunt' },
  { id: 'indiehackers', name: 'Indie Hackers' },
  { id: 'hackernews', name: 'Hacker News' },
  { id: 'dev', name: 'DEV' },
  { id: 'hashnode', name: 'Hashnode' },
  { id: 'replit', name: 'Replit' },
  { id: 'discord', name: 'Discord' },
  { id: 'telegram', name: 'Telegram' },
  { id: 'whatsapp', name: 'WhatsApp' },
]

export const ORGANIC_IDS = ORGANIC_NETWORKS.map((n) => n.id)
export const ORGANIC_LABELS = ORGANIC_NETWORKS.map((n) => n.name).join(', ')

export const PAID_NETWORKS = [
  { id: 'meta', name: 'Meta ads' },
  { id: 'google', name: 'Google Ads' },
]
