import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Film, Image as ImageIcon, Loader2, Trash2, Upload, Wand2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../services/api'

export default function MediaLibrary() {
  const [assets, setAssets] = useState([])
  const [selected, setSelected] = useState([])
  const [uploading, setUploading] = useState(false)
  const [composing, setComposing] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(null)
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [secondsPerImage, setSecondsPerImage] = useState(3)

  const load = async () => {
    try {
      const res = await api.get('/media-library')
      setAssets(res.data.assets || [])
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load your media library')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selected.includes(asset.id)),
    [assets, selected],
  )

  const uploadFiles = async (files) => {
    const list = Array.from(files || [])
    if (!list.length) return

    setUploading(true)
    setError('')
    try {
      const body = new FormData()
      list.forEach((file) => body.append('files', file))
      await api.post('/media-library/upload', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to upload selected photos/videos')
    } finally {
      setUploading(false)
    }
  }

  const toggle = (assetId) => {
    setSelected((current) => current.includes(assetId)
      ? current.filter((id) => id !== assetId)
      : [...current, assetId])
  }

  const compose = async () => {
    if (!selected.length) return
    setComposing(true)
    setError('')
    try {
      const res = await api.post('/media-library/compose', {
        assetIds: selected,
        aspectRatio,
        secondsPerImage: Number(secondsPerImage) || 3,
        maxVideoSeconds: 12,
      })
      setGenerated(res.data.video)
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to generate video from selected media')
    } finally {
      setComposing(false)
    }
  }

  const remove = async (assetId) => {
    try {
      await api.delete(`/media-library/${assetId}`)
      setSelected((current) => current.filter((id) => id !== assetId))
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to remove media')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Media Library</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Choose photos and videos from your device, then let TrillionAI turn the selected media into a post-ready video.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add photos or videos</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              On iPhone, iPad and Android this opens the device photo/video picker. You choose exactly which items the app can use.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Uploading…' : 'Choose from Photos & Videos'}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(event) => {
                uploadFiles(event.target.files)
                event.target.value = ''
              }}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Create a marketing video</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Select media below. The composer crops and sequences it into one social-ready MP4.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-600 dark:text-gray-300">
              Format
              <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} className="mt-1 block rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700">
                <option value="9:16">Vertical 9:16</option>
                <option value="1:1">Square 1:1</option>
                <option value="16:9">Landscape 16:9</option>
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">
              Seconds per photo
              <input type="number" min="1" max="10" value={secondsPerImage} onChange={(event) => setSecondsPerImage(event.target.value)} className="mt-1 block w-28 rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700" />
            </label>
            <button
              type="button"
              onClick={compose}
              disabled={composing || selected.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {composing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {composing ? 'Generating…' : `Generate from ${selected.length} item${selected.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </section>

      {generated && (
        <section className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 font-semibold text-green-800 dark:text-green-300">
                <CheckCircle size={18} />
                Your generated video is ready
              </div>
              <video src={generated.url} controls className="mt-3 max-h-72 rounded-lg bg-black" />
            </div>
            <Link
              to="/dashboard/video-distribution"
              state={{ mediaUrl: generated.url }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
            >
              <Film size={16} />
              Post this video
            </Link>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your uploaded media</h3>
          <span className="text-xs text-gray-500">{selectedAssets.length} selected</span>
        </div>

        {assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700">
            Your media library is empty. Choose photos or videos above to begin.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => {
              const isSelected = selected.includes(asset.id)
              const isVideo = asset.mediaType === 'video' || asset.mimetype?.startsWith('video/')
              return (
                <div key={asset.id} className={`overflow-hidden rounded-xl border bg-white dark:bg-gray-800 ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-gray-200 dark:border-gray-700'}`}>
                  <button type="button" onClick={() => toggle(asset.id)} className="block w-full text-left">
                    <div className="relative aspect-video bg-gray-100 dark:bg-gray-900">
                      {isVideo ? (
                        <video src={asset.url} className="h-full w-full object-cover" muted preload="metadata" />
                      ) : (
                        <img src={asset.url} alt={asset.originalName || 'Uploaded media'} className="h-full w-full object-cover" />
                      )}
                      <div className="absolute left-2 top-2 rounded-full bg-black/60 p-1.5 text-white">
                        {isVideo ? <Film size={14} /> : <ImageIcon size={14} />}
                      </div>
                      {isSelected && (
                        <div className="absolute right-2 top-2 rounded-full bg-blue-600 p-1 text-white">
                          <CheckCircle size={15} />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{asset.originalName || 'Media'}</div>
                      <div className="mt-1 text-xs text-gray-500">{asset.kind === 'generated_video' ? 'Generated video' : asset.mediaType}</div>
                    </div>
                  </button>
                  <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700">
                    <button type="button" onClick={() => remove(asset.id)} className="inline-flex items-center gap-1 text-xs text-red-600">
                      <Trash2 size={13} />
                      Remove from library
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
