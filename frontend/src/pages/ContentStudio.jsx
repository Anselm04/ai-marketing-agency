import { useEffect, useState } from 'react'
import { FileText, Plus, Globe, Sparkles, Search, BookOpen } from 'lucide-react'
import api from '../services/api'

export default function ContentStudio() {
  const [content, setContent] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [form, setForm] = useState({ type: 'article', topic: '', platform: 'blog', keywords: '', tone: 'professional' })
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api.get('/content').then(res => setContent(res.data))
  }, [])

  const handleGenerate = async (e) => {
    e.preventDefault()
    setGenerating(true)
    try {
      const res = await api.post('/content/generate', {
        type: form.type,
        topic: form.topic,
        platform: form.platform,
        keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
        tone: form.tone,
      })
      const saved = await api.post('/content', {
        title: form.topic,
        type: form.type,
        body: res.data.content || res.data.fallback ? `[Generated draft] ${form.topic}` : '',
        platform: form.platform,
      })
      setContent(prev => [saved.data, ...prev])
      setShowForm(false)
      setForm({ type: 'article', topic: '', platform: 'blog', keywords: '', tone: 'professional' })
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  const filtered = content.filter(c => c.title?.toLowerCase().includes(filter.toLowerCase()))

  const typeIcons = {
    article: BookOpen,
    ad_copy: Sparkles,
    script: FileText,
    caption: Search,
    email: FileText,
    landing_page: FileText,
    seo_text: Search,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Studio</h2>
          <p className="text-gray-500 mt-1">Generate and manage AI-powered content</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={18} />
          Generate Content
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search content..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleGenerate} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="article">Article</option>
                <option value="ad_copy">Ad Copy</option>
                <option value="script">Script</option>
                <option value="email">Email</option>
                <option value="seo_text">SEO Text</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
                <option value="blog">Blog</option>
                <option value="TikTok">TikTok</option>
                <option value="Instagram">Instagram</option>
                <option value="Google">Google</option>
                <option value="YouTube">YouTube</option>
                <option value="Facebook">Facebook</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic / Product</label>
              <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma separated)</label>
              <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value })}>
                <option>professional</option>
                <option>casual</option>
                <option>witty</option>
                <option>urgent</option>
                <option>empathetic</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={generating} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{generating ? 'Generating...' : 'Generate with AI'}</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {filtered.map(item => {
          const Icon = typeIcons[item.type] || FileText
          return (
            <div key={item._id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Icon size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      item.status === 'published' ? 'bg-green-50 text-green-700' :
                      item.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                      'bg-yellow-50 text-yellow-700'
                    }`}>{item.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{item.type} &middot; {item.platform} &middot; {new Date(item.createdAt).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-700 mt-2 line-clamp-3">{item.body}</p>
                  {item.translations?.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-blue-600">
                      <Globe size={14} />
                      {item.translations.length} translations
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
