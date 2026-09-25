import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Film, Link2, Send, Upload, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../services/api'

const CATEGORY_LABELS = {
  major: 'Major',
  short_form: 'Short-form',
  live: 'Live / video',
  messaging: 'Messaging',
  niche: 'Creator / niche',
  regional: 'Regional',
  decentralized: 'Decentralized',
}

function platformStatus(platform) {
  if (platform.publish !== 'direct_api') return 'Not available for automatic upload'
  if (!platform.connected) return 'Connect your account first'
  return 'Ready to publish'
}

export default function SocialVideoPublisher() {
  const [platforms, setPlatforms] = useState([])
  const [selected, setSelected] = useState([])
  const [file, setFile] = useState(null)
  const [mediaUrl, setMediaUrl] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [pinterestBoardId, setPinterestBoardId] = useState('')
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [youtubePrivacy, setYoutubePrivacy] = useState('private')
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState([])

  const load = async () => {
    try {
      const res = await api.get('/social-video/platforms')
      setPlatforms(res.data.platforms || [])
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load video platforms')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const readyPlatforms = useMemo(
    () => platforms.filter((platform) => platform.publish === 'direct_api' && platform.connected),
    [platforms],
  )

  const toggle = (platform) => {
    if (platform.publish !== 'direct_api' || !platform.connected) return
    setSelected((current) => current.includes(platform.id)
      ? current.filter((id) => id !== platform.id)
      : [...current, platform.id])
  }

  const uploadFile = async () => {
    if (!file) return mediaUrl
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await api.post('/uploads/s3-direct', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url = res.data?.file?.url
      if (!url) throw new Error('Upload completed without a public media URL')
      setMediaUrl(url)
      return url
    } finally {
      setUploading(false)
    }
  }

  const handlePublish = async (event) => {
    event.preventDefault()
    setError('')
    setResults([])

    if (selected.length === 0) {
      setError('Select at least one connected platform.')
      return
    }

    setPublishing(true)
    try {
      const videoUrl = file ? await uploadFile() : mediaUrl.trim()
      if (!videoUrl) throw new Error('Choose a video file or provide a public video URL')

      const settings = {
        youtube: { privacyStatus: youtubePrivacy },
        pinterest: {
          boardId: pinterestBoardId || undefined,
          coverImageUrl: coverImageUrl || undefined,
        },
      }

      const res = await api.post('/social-video/publish-many', {
        platformIds: selected,
        mediaUrl: videoUrl,
        title,
        caption,
        hashtags: hashtags.split(',').map((tag) => tag.trim()).filter(Boolean),
        settings,
      })
      setResults(res.data?.results || [])
    } catch (err) {
      const responseResults = err.response?.data?.results
      if (Array.isArray(responseResults)) setResults(responseResults)
      setError(err.response?.data?.error || err.message || 'Video publishing failed')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading video publishing connections…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Film size={24} className="text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Video Distribution</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload once and publish through each user’s own connected social accounts.
          </p>
        </div>
        <Link
          to="/dashboard/connectors"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
        >
          <Link2 size={16} />
          Manage social accounts
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="text-xs text-gray-500">Connected & upload-ready</div>
          <div className="text-2xl font-bold mt-1">{readyPlatforms.length}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="text-xs text-gray-500">Platforms catalogued</div>
          <div className="text-2xl font-bold mt-1">{platforms.length}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="text-xs text-gray-500">Selected for this video</div>
          <div className="text-2xl font-bold mt-1">{selected.length}</div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Choose where this video should go</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {platforms.map((platform) => {
            const selectable = platform.publish === 'direct_api' && platform.connected
            const isSelected = selected.includes(platform.id)
            return (
              <button
                type="button"
                key={platform.id}
                onClick={() => toggle(platform)}
                disabled={!selectable}
                className={`text-left rounded-lg border p-3 transition-colors ${isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700'} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{platform.name}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{CATEGORY_LABELS[platform.category] || platform.category}</div>
                  </div>
                  {selectable
                    ? <CheckCircle size={15} className={isSelected ? 'text-blue-600' : 'text-green-500'} />
                    : <XCircle size={15} className="text-gray-400" />}
                </div>
                <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{platformStatus(platform)}</div>
              </button>
            )
          })}
        </div>
      </section>

      <form onSubmit={handlePublish} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Upload size={17} className="text-blue-600" />
          Upload video
        </h3>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block text-sm">
            <span className="block mb-1 text-gray-700 dark:text-gray-300">Video file</span>
            <input
              type="file"
              accept="video/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2"
            />
            <span className="block mt-1 text-xs text-gray-500">
              Files are uploaded to the app’s durable S3-compatible media storage before publishing.
            </span>
          </label>

          <label className="block text-sm">
            <span className="block mb-1 text-gray-700 dark:text-gray-300">Or public video URL</span>
            <input
              type="url"
              value={mediaUrl}
              onChange={(event) => setMediaUrl(event.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="block mb-1 text-gray-700 dark:text-gray-300">Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="block mb-1 text-gray-700 dark:text-gray-300">Hashtags, comma separated</span>
            <input value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="#brand, #launch" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2" />
          </label>
        </div>

        <label className="block text-sm">
          <span className="block mb-1 text-gray-700 dark:text-gray-300">Caption</span>
          <textarea rows={4} value={caption} onChange={(event) => setCaption(event.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2" />
        </label>

        {selected.includes('youtube') && (
          <label className="block text-sm max-w-sm">
            <span className="block mb-1 text-gray-700 dark:text-gray-300">YouTube privacy</span>
            <select value={youtubePrivacy} onChange={(event) => setYoutubePrivacy(event.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2">
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
          </label>
        )}

        {selected.includes('pinterest') && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="block mb-1 text-gray-700 dark:text-gray-300">Pinterest board ID</span>
              <input required value={pinterestBoardId} onChange={(event) => setPinterestBoardId(event.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="block mb-1 text-gray-700 dark:text-gray-300">Pinterest cover image URL</span>
              <input required type="url" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2" />
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={publishing || uploading || selected.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
        >
          <Send size={16} />
          {uploading ? 'Uploading video…' : publishing ? 'Publishing…' : `Publish to ${selected.length} platform${selected.length === 1 ? '' : 's'}`}
        </button>
      </form>

      {results.length > 0 && (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Publishing results</h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div key={`${result.platform}-${index}`} className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 text-sm">
                {result.success
                  ? <CheckCircle size={17} className="text-green-500 mt-0.5" />
                  : <XCircle size={17} className="text-red-500 mt-0.5" />}
                <div>
                  <div className="font-medium capitalize">{result.platform}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {result.success
                      ? result.published ? 'Published successfully.' : 'Accepted by the platform and processing.'
                      : result.error || 'Publishing failed.'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
