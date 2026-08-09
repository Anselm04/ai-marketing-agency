import { useEffect, useState } from 'react'
import { FileText, CheckCircle, Download } from 'lucide-react'
import api from '../services/api'

export default function Legal() {
  const [templates, setTemplates] = useState([])
  const [generating, setGenerating] = useState(null)
  const [generatedDoc, setGeneratedDoc] = useState(null)

  useEffect(() => {
    api.get('/legal/templates').then(res => setTemplates(res.data))
  }, [])

  const handleGenerate = (type) => {
    setGenerating(type)
    api.post('/legal/generate', {
      type,
      businessName: 'AI Marketing Agency',
      jurisdiction: 'Global'
    }).then(res => {
      setGeneratedDoc(res.data)
      setGenerating(null)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Legal Automation</h2>
        <p className="text-gray-500 mt-1">Auto-generate compliance documents and legal templates</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <FileText size={20} className="text-indigo-600" />
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                t.status === 'ready' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
              }`}>
                {t.status}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 mt-3">{t.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{t.type}</p>
            <button
              onClick={() => handleGenerate(t.id)}
              disabled={generating === t.id}
              className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {generating === t.id ? 'Generating...' : <><Download size={16} /> Generate</>}
            </button>
          </div>
        ))}
      </div>

      {generatedDoc && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={20} className="text-green-600" />
            <h3 className="font-semibold text-gray-900">Generated Document</h3>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 font-mono">
            {generatedDoc.document}
          </div>
          <p className="text-xs text-gray-400 mt-2">Generated at: {new Date(generatedDoc.generatedAt).toLocaleString()}</p>
        </div>
      )}
    </div>
  )
}