import { useEffect, useState } from 'react'
import { Share2, CheckCircle, XCircle, Send, Globe, Gamepad2, Briefcase, MessageCircle, ShoppingCart, Smartphone, Star, FileText, Megaphone, Headphones, Heart, ChevronDown, ChevronUp, Zap, Monitor, Youtube, Twitch, Music, Radio } from 'lucide-react'
import api from '../services/api'

const platformIcons = {
  TikTok: Music,
  Instagram: Share2,
  Facebook: Globe,
  'Twitter/X': Zap,
  LinkedIn: Briefcase,
  Pinterest: Star,
  Snapchat: MessageCircle,
  Reddit: Globe,
  Threads: FileText,
  Bluesky: Globe,
  Mastodon: Globe,
  YouTube: Youtube,
  Twitch: Monitor,
  Vimeo: Monitor,
  Rumble: Monitor,
  Steam: Gamepad2,
  Discord: MessageCircle,
  Roblox: Gamepad2,
  'Epic Games': Gamepad2,
  'itch.io': Gamepad2,
  'Game Jolt': Gamepad2,
  'Nintendo eShop': Gamepad2,
  'PlayStation Store': Gamepad2,
  'Xbox Store': Gamepad2,
  'Product Hunt': Star,
  'Hacker News': Globe,
  Crunchbase: Briefcase,
  G2: Star,
  Capterra: Star,
  Clutch: Briefcase,
  WhatsApp: MessageCircle,
  Telegram: MessageCircle,
  Slack: Briefcase,
  Messenger: MessageCircle,
  WeChat: MessageCircle,
  LINE: MessageCircle,
  Amazon: ShoppingCart,
  eBay: ShoppingCart,
  Etsy: ShoppingCart,
  Shopify: ShoppingCart,
  Gumroad: ShoppingCart,
  AppSumo: ShoppingCart,
  Alibaba: ShoppingCart,
  Rakuten: ShoppingCart,
  'App Store': Smartphone,
  'Google Play': Smartphone,
  'Galaxy Store': Smartphone,
  'Huawei AppGallery': Smartphone,
  'Amazon Appstore': Smartphone,
  Trustpilot: Star,
  Yelp: Star,
  'Google Business': Briefcase,
  TripAdvisor: Star,
  BBB: Briefcase,
  Medium: FileText,
  Substack: FileText,
  Quora: Globe,
  'Dev.to': FileText,
  Hashnode: FileText,
  'Indie Hackers': Globe,
  'Stack Overflow': Globe,
  Spotify: Music,
  'Apple Podcasts': Headphones,
  SoundCloud: Music,
  Clubhouse: Radio,
  Patreon: Heart,
  'Ko-fi': Heart,
  'Buy Me a Coffee': Heart,
  OnlyFans: Heart,
  'Google Ads': Megaphone,
  'Meta Ads': Megaphone,
  'TikTok Ads': Megaphone,
  'LinkedIn Ads': Megaphone,
  'Twitter Ads': Megaphone,
  'Pinterest Ads': Megaphone,
  'Snapchat Ads': Megaphone,
  'Reddit Ads': Megaphone,
  'Amazon Ads': Megaphone,
  'Microsoft Ads': Megaphone,
  Taboola: Megaphone,
  Outbrain: Megaphone,
};

const categoryColors = {
  Social: 'bg-pink-50 text-pink-700 border-pink-200',
  Video: 'bg-red-50 text-red-700 border-red-200',
  Gaming: 'bg-purple-50 text-purple-700 border-purple-200',
  Professional: 'bg-blue-50 text-blue-700 border-blue-200',
  Messaging: 'bg-green-50 text-green-700 border-green-200',
  'E-commerce': 'bg-orange-50 text-orange-700 border-orange-200',
  'App Store': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Reviews: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Content: 'bg-teal-50 text-teal-700 border-teal-200',
  Ads: 'bg-rose-50 text-rose-700 border-rose-200',
  Audio: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Creator: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function Social() {
  const [platforms, setPlatforms] = useState([])
  const [form, setForm] = useState({
    caption: '',
    hashtags: '',
    videoUrl: '',
    imageUrl: '',
    selectedPlatforms: {},
  })
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState({
    Social: true,
    Video: true,
    Gaming: true,
    Ads: true,
  })

  useEffect(() => {
    api.get('/social/status').then(res => setPlatforms(res.data))
  }, [])

  const groupedPlatforms = platforms.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  const togglePlatform = (platform) => {
    setForm(prev => ({
      ...prev,
      selectedPlatforms: {
        ...prev.selectedPlatforms,
        [platform]: !prev.selectedPlatforms[platform]
      }
    }))
  }

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))
  }

  const handlePublish = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        caption: form.caption,
        hashtags: form.hashtags.split(',').map(h => h.trim()).filter(Boolean),
        videoUrl: form.videoUrl,
        imageUrl: form.imageUrl,
      }
      Object.keys(form.selectedPlatforms).forEach(key => {
        if (form.selectedPlatforms[key]) payload[key] = true
      })
      const res = await api.post('/social/publish', payload)
      setResults(res.data.results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const selectedCount = Object.values(form.selectedPlatforms).filter(Boolean).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Social Media & Platforms</h2>
        <p className="text-gray-500 mt-1">Publish across all platforms — social, gaming, e-commerce, app stores, reviews, and more</p>
      </div>

      {Object.entries(groupedPlatforms).map(([category, items]) => {
        const isExpanded = expandedCategories[category] !== false
        const Icon = platformIcons[items[0]?.name] || Globe
        return (
          <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium border ${categoryColors[category] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                  {category}
                </span>
                <span className="text-sm text-gray-500">{items.length} platforms</span>
              </div>
              {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>
            {isExpanded && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4 pt-0">
                {items.map(p => {
                  const PlatformIcon = platformIcons[p.name] || Globe
                  const isSelected = form.selectedPlatforms[p.platform]
                  return (
                    <button
                      key={p.platform}
                      onClick={() => togglePlatform(p.platform)}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-all text-left ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <PlatformIcon size={16} className={isSelected ? 'text-blue-600' : p.connected ? 'text-green-600' : 'text-gray-400'} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">{p.name}</div>
                        <div className={`text-[10px] ${p.connected ? 'text-green-600' : 'text-gray-400'}`}>
                          {p.connected ? 'Connected' : 'Not configured'}
                        </div>
                      </div>
                      {isSelected && <CheckCircle size={14} className="text-blue-600" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <form onSubmit={handlePublish} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Send size={18} className="text-blue-600" />
            Publish Content
          </h3>
          <span className="text-sm text-gray-500">{selectedCount} platform{selectedCount !== 1 ? 's' : ''} selected</span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Caption / Text</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            rows={3}
            value={form.caption}
            onChange={e => setForm({ ...form, caption: e.target.value })}
            placeholder="Write your post caption here..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hashtags (comma separated)</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            value={form.hashtags}
            onChange={e => setForm({ ...form, hashtags: e.target.value })}
            placeholder="#marketing, #ai, #growth"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={form.videoUrl}
              onChange={e => setForm({ ...form, videoUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={form.imageUrl}
              onChange={e => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || selectedCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={16} />
          {loading ? 'Publishing to ' + selectedCount + ' platforms...' : `Publish to ${selectedCount} platform${selectedCount !== 1 ? 's' : ''}`}
        </button>
      </form>

      {results && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Publish Results</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-gray-50">
                {r.fallback ? (
                  <XCircle size={16} className="text-yellow-500" />
                ) : r.success ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <XCircle size={16} className="text-red-600" />
                )}
                <span className="font-medium text-gray-900 min-w-[120px]">{r.platform}</span>
                <span className="text-gray-600">
                  {r.fallback ? r.message : r.success ? 'Published successfully' : r.error}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}