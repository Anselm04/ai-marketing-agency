import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import api from '../services/api'

const EXPORTS = [
  { format: 'bundle-json', label: 'Course Bundle' },
  { format: 'manual-markdown', label: 'Printable Manual' },
  { format: 'skool-json', label: 'Skool Package' },
  { format: 'youtube-json', label: 'YouTube Metadata' },
  { format: 'worksheets-json', label: 'Worksheets' },
  { format: 'quiz-bank-json', label: 'Quiz Bank' },
  { format: 'marketing-kit-json', label: 'Marketing Kit' },
  { format: 'short-form-json', label: 'Short-form Plan' },
]

function filenameFromDisposition(disposition, fallback) {
  const match = String(disposition || '').match(/filename="?([^";]+)"?/i)
  return match?.[1] || fallback
}

export async function downloadCourseExport(projectId, format) {
  const response = await api.get(`/course-factory/projects/${projectId}/exports/${format}`, {
    responseType: 'blob',
  })
  const contentType = response.headers?.['content-type'] || 'application/octet-stream'
  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data], { type: contentType })
  const extension = format === 'manual-markdown' ? 'md' : 'json'
  const filename = filenameFromDisposition(
    response.headers?.['content-disposition'],
    `course-${projectId}-${format}.${extension}`,
  )
  const href = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = filename
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(href)
  }
  return filename
}

export default function CourseFactoryDownloads({ project, onError }) {
  const [downloading, setDownloading] = useState('')
  const available = project?.approval?.status === 'approved' && Boolean(project?.coursePackage)
  if (!available) return null

  const download = async (format) => {
    setDownloading(format)
    try {
      await downloadCourseExport(project.id, format)
    } catch (error) {
      onError?.(error.response?.data?.error || error.message || 'Course export failed')
    } finally {
      setDownloading('')
    }
  }

  return (
    <div className="mt-4 rounded-lg border px-3 py-3" style={{ borderColor: 'var(--line)' }}>
      <div className="mb-2 text-sm font-semibold">Approved course downloads</div>
      <div className="flex flex-wrap gap-2">
        {EXPORTS.map(({ format, label }) => (
          <button
            key={format}
            type="button"
            disabled={Boolean(downloading)}
            onClick={() => download(format)}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            style={{ borderColor: 'var(--line)' }}
          >
            {downloading === format ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
