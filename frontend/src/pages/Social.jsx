import { useEffect, useState } from 'react'
import { Share2, CheckCircle, XCircle, Send } from 'lucide-react'
import api from '../services/api'

export default function Social() {
  const [platforms, setPlatforms] = useState([])
  const [form, setForm] = useState({
    caption: '',
    hashtags: '',
    videoUrl: '',
    imageUrl: '',
    tiktok: true,
    instagram: true,
  })
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/social/status').then(res => setPlatforms(res.data))
  }, [])

  const handlePublish = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/social/publish', {
        caption: form.caption,
        hashtags: form.hashtags.split(',').map(h => h.trim()).filter(Boolean),
        videoUrl: form.videoUrl,
        imageUrl: form.imageUrl,
        tiktok: form.tiktok,
        instagram: form.instagram,
      })
      setResults(res.data.results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Social Media</h2>
        <p className="text-gray-500 mt-1">Manage platforms and publish content across all channels</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {platforms.map(p => (
          <div key={p.platform} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{p.name}</span>
              {p.connected ? (
                <CheckCircle size={18} className="text-green-600" />
              ) : (
                <XCircle size={18} className="text-gray-400" />
              )}
            </div>
            <p className={`text-xs mt-1 ${p.connected ? 'text-green-600' : 'text-gray-400'}`}>
              {p.connected ? 'Connected' : 'Not configured'}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handlePublish} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Publish Content</h3>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Video URL (TikTok)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={form.videoUrl}
              onChange={e => setForm({ ...form, videoUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (Instagram)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={form.imageUrl}
              onChange={e => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.tiktok}
              onChange={e => setForm({ ...form, tiktok: e.target.checked })}
            />
            TikTok
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.instagram}
              onChange={e => setForm({ ...form, instagram: e.target.checked })}
            />
            Instagram
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={16} />
          {loading ? 'Publishing...' : 'Publish Now'}
        </button>
      </form>

      {results && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Publish Results</h3>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {r.fallback ? (
                  <XCircle size={16} className="text-yellow-500" />
                ) : r.success ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <XCircle size={16} className="text-red-600" />
                )}
                <span className="text-gray-700">
                  {r.platform}: {r.fallback ? r.message : r.success ? 'Published successfully' : r.error}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}