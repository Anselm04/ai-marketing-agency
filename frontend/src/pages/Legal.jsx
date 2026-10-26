import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Download, FileText } from 'lucide-react'
import api from '../services/api'

export default function Legal() {
  const [templates, setTemplates] = useState([])
  const [generating, setGenerating] = useState(null)
  const [generatedDoc, setGeneratedDoc] = useState(null)
  const [businessName, setBusinessName] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/legal/templates')
      .then(res => setTemplates(res.data))
      .catch(() => setError('Legal document options could not be loaded.'))
  }, [])

  const handleGenerate = async (type) => {
    if (!businessName.trim() || !jurisdiction.trim()) {
      setError('Enter the customer business name and applicable jurisdiction before generating a legal draft.')
      return
    }

    setGenerating(type)
    setGeneratedDoc(null)
    setError('')
    try {
      const res = await api.post('/legal/generate', {
        type,
        businessName: businessName.trim(),
        jurisdiction: jurisdiction.trim(),
      })
      setGeneratedDoc(res.data?.document || null)
    } catch (err) {
      setError(err.response?.data?.error || 'The legal draft could not be generated. Nothing was saved.')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Legal Drafting</h2>
        <p className="text-gray-500 mt-1">Generate review-required legal and compliance drafts from real customer details.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-700 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-amber-900">Human legal review is required</p>
          <p className="text-sm text-amber-800 mt-1">
            Generated documents are drafts, not verified legal advice. Review them for the applicable jurisdiction before publishing, signing, or relying on them.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900">Document context</h3>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <label className="text-sm text-gray-700">
            Business name
            <input
              aria-label="Business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Customer business name"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            Applicable jurisdiction
            <input
              aria-label="Applicable jurisdiction"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              placeholder="e.g. New Zealand"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <FileText size={20} className="text-indigo-600" />
              </div>
              <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-50 text-yellow-700">
                Review required
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 mt-3">{t.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{t.type}</p>
            <button
              type="button"
              onClick={() => handleGenerate(t.id)}
              disabled={generating === t.id || !businessName.trim() || !jurisdiction.trim()}
              className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {generating === t.id ? 'Generating...' : <><Download size={16} /> Generate draft</>}
            </button>
          </div>
        ))}
      </div>

      {generatedDoc && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={20} className="text-indigo-600" />
            <h3 className="font-semibold text-gray-900">Generated draft — legal review pending</h3>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
            {generatedDoc.document}
          </div>
          <div className="mt-3 text-xs text-gray-500 space-y-1">
            <p>Business: {generatedDoc.businessName}</p>
            <p>Jurisdiction: {generatedDoc.jurisdiction}</p>
            <p>Status: {generatedDoc.reviewStatus || 'pending_legal_review'}</p>
            {generatedDoc.generatedAt && <p>Generated at: {new Date(generatedDoc.generatedAt).toLocaleString()}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
