import { useState } from 'react'
import { Video, Clapperboard, Image, Hash, Play, Wand2 } from 'lucide-react'
import api from '../services/api'

export default function VideoStudio() {
  const [tab, setTab] = useState('script')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [form, setForm] = useState({ videoType: 'short-form', topic: '', duration: 30, platform: 'TikTok', product: '', audience: '', script: '', style: 'modern', brandColors: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      let res
      if (tab === 'script') res = await api.post('/video/script', { videoType: form.videoType, topic: form.topic, duration: form.duration, platform: form.platform })
      else if (tab === 'storyboard') res = await api.post('/video/storyboard', { script: form.script, style: form.style })
      else if (tab === 'thumbnails') res = await api.post('/video/thumbnails', { topic: form.topic, brandColors: form.brandColors })
      else if (tab === 'hashtags') res = await api.post('/video/hashtags', { topic: form.topic, platform: form.platform })
      else if (tab === 'ad') res = await api.post('/video/ad', { product: form.product, audience: form.audience, duration: form.duration })
      setResult(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'script', label: 'Script', icon: Clapperboard },
    { id: 'storyboard', label: 'Storyboard', icon: Image },
    { id: 'thumbnails', label: 'Thumbnails', icon: Image },
    { id: 'hashtags', label: 'Hashtags', icon: Hash },
    { id: 'ad', label: 'Video Ad', icon: Play },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Video Studio</h2>
        <p className="text-gray-500 mt-1">Generate scripts, storyboards, and video concepts</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setResult(null) }}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'script' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video Type</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.videoType} onChange={e => setForm({ ...form, videoType: e.target.value })}>
                    <option>short-form</option>
                    <option>long-form</option>
                    <option>tutorial</option>
                    <option>testimonial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
                    <option>TikTok</option>
                    <option>Instagram</option>
                    <option>YouTube</option>
                    <option>Facebook</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (seconds)</label>
                  <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.duration} onChange={e => setForm({ ...form, duration: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="e.g., How to grow your app with AI" />
              </div>
            </>
          )}

          {tab === 'storyboard' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Script</label>
                <textarea required rows={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.script} onChange={e => setForm({ ...form, script: e.target.value })} placeholder="Paste your script here..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visual Style</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.style} onChange={e => setForm({ ...form, style: e.target.value })}>
                  <option>modern</option>
                  <option>minimal</option>
                  <option>bold</option>
                  <option>luxury</option>
                  <option>playful</option>
                </select>
              </div>
            </>
          )}

          {tab === 'thumbnails' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Video Topic</label>
                <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Colors</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.brandColors} onChange={e => setForm({ ...form, brandColors: e.target.value })} placeholder="e.g., blue, white, black" />
              </div>
            </>
          )}

          {tab === 'hashtags' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Video Topic</label>
                <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
                  <option>TikTok</option>
                  <option>Instagram</option>
                  <option>YouTube</option>
                </select>
              </div>
            </>
          )}

          {tab === 'ad' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product / App</label>
                <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (seconds)</label>
                <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.duration} onChange={e => setForm({ ...form, duration: Number(e.target.value) })} />
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            <Wand2 size={16} />
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </form>

        {result && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Result</h3>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-gray-100">{result.content || result.document || JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
