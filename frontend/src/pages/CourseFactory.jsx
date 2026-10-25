import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen, CheckCircle2, Eye, FileVideo, GraduationCap, Loader2,
  Sparkles, UploadCloud, WandSparkles,
} from 'lucide-react'
import api from '../services/api'

const emptyForm = {
  name: '',
  targetAudience: '',
  desiredOutcome: '',
  skillLevel: 'all-levels',
  confirmedOwnership: false,
  commercialUseAllowed: false,
}

function statusLabel(project) {
  if (project.approval?.status === 'approved') return 'Approved'
  return `Approval ${project.approval?.status || 'pending'}`
}

async function uploadVideoMultipart(project, file, onProgress) {
  const start = await api.post(`/course-factory/projects/${project.id}/uploads/multipart`, {
    filename: file.name,
    contentType: file.type || 'video/mp4',
    size: file.size,
  })
  const { partSize } = start.data.upload
  const parts = []
  const totalParts = Math.ceil(file.size / partSize)

  try {
    for (let index = 0; index < totalParts; index += 1) {
      const partNumber = index + 1
      const signed = await api.post(`/course-factory/projects/${project.id}/uploads/multipart/part`, { partNumber })
      const startByte = index * partSize
      const endByte = Math.min(file.size, startByte + partSize)
      const blob = file.slice(startByte, endByte)
      const response = await fetch(signed.data.url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
      if (!response.ok) throw new Error(`Upload part ${partNumber} failed with HTTP ${response.status}`)
      const etag = response.headers.get('ETag') || response.headers.get('etag')
      if (!etag) throw new Error('Storage did not expose the ETag header. Configure bucket CORS to expose ETag.')
      parts.push({ partNumber, etag })
      onProgress?.(Math.round((partNumber / totalParts) * 100))
    }

    const completed = await api.post(`/course-factory/projects/${project.id}/uploads/multipart/complete`, { parts })
    return completed.data
  } catch (error) {
    try {
      await api.post(`/course-factory/projects/${project.id}/uploads/multipart/abort`, {})
    } catch {
      // Preserve the original upload error.
    }
    throw error
  }
}

export default function CourseFactory() {
  const [projects, setProjects] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState(null)
  const [uploadProgress, setUploadProgress] = useState({})
  const [error, setError] = useState('')

  const loadProjects = async () => {
    try {
      setError('')
      const res = await api.get('/course-factory/projects')
      setProjects(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load Course Factory projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProjects() }, [])

  const readyCount = useMemo(
    () => projects.filter((project) => ['package_ready', 'approved'].includes(project.status)).length,
    [projects],
  )

  const createProject = async (event) => {
    event.preventDefault()
    setWorkingId('new')
    setError('')
    try {
      await api.post('/course-factory/projects', {
        name: form.name,
        targetAudience: form.targetAudience,
        desiredOutcome: form.desiredOutcome,
        skillLevel: form.skillLevel,
        rightsManifest: {
          confirmedOwnership: form.confirmedOwnership,
          commercialUseAllowed: form.commercialUseAllowed,
          allowedPlatforms: ['YouTube', 'Skool'],
          territories: ['worldwide'],
        },
      })
      setForm(emptyForm)
      await loadProjects()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create Course Factory project')
    } finally {
      setWorkingId(null)
    }
  }

  const uploadSource = async (project, file) => {
    if (!file) return
    setWorkingId(`${project.id}:upload`)
    setError('')
    setUploadProgress((current) => ({ ...current, [project.id]: 0 }))
    try {
      await uploadVideoMultipart(project, file, (value) => {
        setUploadProgress((current) => ({ ...current, [project.id]: value }))
      })
      await loadProjects()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Video upload failed')
    } finally {
      setWorkingId(null)
    }
  }

  const runAction = async (project, action) => {
    setWorkingId(`${project.id}:${action}`)
    setError('')
    try {
      await api.post(`/course-factory/projects/${project.id}/${action}`, {})
      await loadProjects()
    } catch (err) {
      const details = err.response?.data?.details
      setError(details?.join(' ') || err.response?.data?.error || `${action} failed`)
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap size={28} style={{ color: 'var(--gold-bright)' }} />
            <h2 className="text-2xl font-bold">Course Factory</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm" style={{ color: 'var(--text-muted)' }}>
            Upload long-form expert footage and turn it into a structured professional course, Skool-ready lessons,
            YouTube metadata, printable teaching material, quizzes, worksheets and short-form marketing derivatives.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl px-4 py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
            <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Projects</div>
            <div className="mt-1 text-xl font-bold">{projects.length}</div>
          </div>
          <div className="rounded-xl px-4 py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
            <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Package ready</div>
            <div className="mt-1 text-xl font-bold">{readyCount}</div>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={18} style={{ color: 'var(--gold)' }} />
          <h3 className="font-semibold">Create course project</h3>
        </div>
        <form onSubmit={createProject} className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Course name</span>
            <input aria-label="Course name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--line)' }} placeholder="Learn to Carve Academy — Master Waka Huia" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Target audience</span>
            <input aria-label="Target audience" value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--line)' }} placeholder="Beginners through advanced carvers" />
          </label>
          <label className="space-y-1 text-sm lg:col-span-2">
            <span>Desired outcome</span>
            <textarea aria-label="Desired outcome" rows={3} value={form.desiredOutcome} onChange={(e) => setForm({ ...form, desiredOutcome: e.target.value })} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--line)' }} placeholder="What should a student be able to do by the end?" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Skill level</span>
            <select value={form.skillLevel} onChange={(e) => setForm({ ...form, skillLevel: e.target.value })} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--line)', color: 'var(--text)' }}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="all-levels">Beginner → Advanced</option>
            </select>
          </label>
          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input aria-label="I own this footage" type="checkbox" checked={form.confirmedOwnership} onChange={(e) => setForm({ ...form, confirmedOwnership: e.target.checked })} className="mt-1" />
              <span>I own this footage or have permission to use it.</span>
            </label>
            <label className="flex items-start gap-2">
              <input aria-label="Commercial use" type="checkbox" checked={form.commercialUseAllowed} onChange={(e) => setForm({ ...form, commercialUseAllowed: e.target.checked })} className="mt-1" />
              <span>Commercial use is allowed for this footage.</span>
            </label>
          </div>
          <div className="lg:col-span-2">
            <button disabled={workingId === 'new'} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold" style={{ background: 'var(--gold)', color: '#111' }}>
              {workingId === 'new' ? <Loader2 className="animate-spin" size={17} /> : <BookOpen size={17} />}
              Create Course Project
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {loading && <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading Course Factory projects…</div>}
        {!loading && projects.length === 0 && (
          <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', color: 'var(--text-muted)' }}>
            Create your first course project, then upload the raw long-form video. You do not need to edit it first.
          </div>
        )}
        {projects.map((project) => {
          const busy = workingId?.startsWith(`${project.id}:`)
          const progress = uploadProgress[project.id]
          const modules = project.coursePackage?.modules || project.curriculum?.modules || []
          return (
            <article key={project.id} className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FileVideo size={20} style={{ color: 'var(--cyan)' }} />
                    <h3 className="text-lg font-semibold">{project.name}</h3>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full px-2.5 py-1" style={{ background: 'var(--bg-elev)', color: 'var(--text-muted)' }}>{project.status}</span>
                    <span className="rounded-full px-2.5 py-1" style={{ background: project.approval?.status === 'approved' ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.15)', color: project.approval?.status === 'approved' ? '#22c55e' : '#f59e0b' }}>{statusLabel(project)}</span>
                    {modules.length > 0 && <span className="rounded-full px-2.5 py-1" style={{ background: 'rgba(34,211,238,.12)', color: 'var(--cyan)' }}>{modules.length} modules</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--line)' }}>
                    <UploadCloud size={16} /> Upload long video
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => uploadSource(project, e.target.files?.[0])} />
                  </label>
                  <button disabled={busy || !project.sourceUrl} onClick={() => runAction(project, 'transcribe')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40" style={{ borderColor: 'var(--line)' }}><WandSparkles size={16} /> Transcribe</button>
                  <button disabled={busy || !project.sourceUrl} onClick={() => runAction(project, 'analyse-visuals')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40" style={{ borderColor: 'var(--line)' }}><Eye size={16} /> Analyse silent footage</button>
                  <button disabled={busy} onClick={() => runAction(project, 'generate-curriculum')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40" style={{ borderColor: 'var(--line)' }}><BookOpen size={16} /> Generate curriculum</button>
                  <button disabled={busy} onClick={() => runAction(project, 'generate-package')} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--gold)', color: '#111' }}><Sparkles size={16} /> Generate Professional Package</button>
                  <button disabled={busy || (!project.coursePackage && !project.curriculum) || project.approval?.status === 'approved'} onClick={() => runAction(project, 'approve')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40" style={{ borderColor: 'var(--line)' }}><CheckCircle2 size={16} /> Approve Course</button>
                </div>
              </div>

              {typeof progress === 'number' && progress < 100 && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}><span>Direct multipart upload</span><span>{progress}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--bg-elev)' }}><div className="h-full" style={{ width: `${progress}%`, background: 'var(--gold)' }} /></div>
                </div>
              )}

              {project.visualAnalysis?.sampledFrames > 0 && (
                <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: 'var(--bg-elev)' }}>
                  Visual analysis sampled {project.visualAnalysis.sampledFrames} frames. Machine observations remain review-required until you approve the course.
                </div>
              )}

              {modules.length > 0 && (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {modules.slice(0, 12).map((module) => (
                    <div key={module.id || module.title} className="rounded-lg p-3" style={{ background: 'var(--bg-elev)' }}>
                      <div className="font-medium">{module.title}</div>
                      <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{module.lessons?.length || 0} lessons</div>
                    </div>
                  ))}
                </div>
              )}

              {project.exportManifest && (
                <div className="mt-4 rounded-lg border px-3 py-3 text-sm" style={{ borderColor: 'var(--line)' }}>
                  <strong>Output package:</strong> Skool-ready course structure, YouTube metadata, printable manual content, worksheets, quizzes, marketing kit and short-form plan. Direct Skool publishing is not claimed until a supported integration is connected.
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

export { uploadVideoMultipart }
