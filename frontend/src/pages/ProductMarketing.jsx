import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, Mic, MicOff, Image, X, ShoppingCart, Sparkles, ChevronRight,
  Check, Copy, FileText, Megaphone, Video, Mail, Search, BookOpen,
  ArrowRight, Loader2, AlertTriangle, Globe, DollarSign, Users, Tag,
  Zap, BarChart3, Lightbulb
} from 'lucide-react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

const platforms = [
  { id: 'TikTok', label: 'TikTok', icon: Zap },
  { id: 'Instagram', label: 'Instagram', icon: Image },
  { id: 'Google', label: 'Google Ads', icon: Search },
  { id: 'YouTube', label: 'YouTube', icon: Video },
  { id: 'Facebook', label: 'Facebook', icon: Users },
  { id: 'LinkedIn', label: 'LinkedIn', icon: Tag },
  { id: 'Email', label: 'Email', icon: Mail },
  { id: 'Blog', label: 'Blog/Website', icon: BookOpen },
]

const tones = ['professional', 'casual', 'witty', 'luxury', 'playful', 'empathetic']
const categories = ['electronics', 'fashion', 'beauty', 'food', 'home', 'fitness', 'software', 'other']

export default function ProductMarketing() {
  const [step, setStep] = useState('input') // input | processing | results
  const [photos, setPhotos] = useState([])
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState(null)
  const [form, setForm] = useState({
    productName: '',
    description: '',
    platforms: platforms.map(p => p.id),
    budget: '1000',
    tone: 'professional',
    targetAudience: '',
    category: 'other',
  })
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [copied, setCopied] = useState(null)
  const fileInputRef = useRef(null)
  const { addToast } = useToast()
  const navigate = useNavigate()

  // Voice recording setup
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const rec = new SpeechRecognition()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'
      rec.onresult = (event) => {
        let final = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript + ' '
        }
        if (final) setTranscript(prev => prev + final)
      }
      rec.onerror = (err) => {
        console.error('Speech error:', err)
        setIsRecording(false)
        addToast('Voice recording error. Please type instead.', 'error')
      }
      rec.onend = () => setIsRecording(false)
      setRecognition(rec)
    }
  }, [addToast])

  const toggleRecording = () => {
    if (!recognition) {
      addToast('Voice recording not supported in this browser. Please type your description.', 'warning')
      return
    }
    if (isRecording) {
      recognition.stop()
      setIsRecording(false)
    } else {
      setTranscript('')
      recognition.start()
      setIsRecording(true)
    }
  }

  const handlePhotoDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length + photos.length > 10) {
      addToast('Maximum 10 photos allowed', 'warning')
      return
    }
    setPhotos(prev => [...prev, ...files])
  }

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
    if (files.length + photos.length > 10) {
      addToast('Maximum 10 photos allowed', 'warning')
      return
    }
    setPhotos(prev => [...prev, ...files])
  }

  const removePhoto = (idx) => setPhotos(prev => prev.filter((_, i) => i !== idx))

  const togglePlatform = (id) => {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(id)
        ? prev.platforms.filter(p => p !== id)
        : [...prev.platforms, id],
    }))
  }

  const handleSubmit = async () => {
    if (!form.description && !transcript && photos.length === 0) {
      addToast('Please provide a product description or upload photos', 'error')
      return
    }
    if (form.platforms.length === 0) {
      addToast('Please select at least one platform', 'error')
      return
    }

    setLoading(true)
    setStep('processing')
    try {
      const data = new FormData()
      data.append('productName', form.productName || 'Untitled Product')
      data.append('description', form.description || transcript || '')
      data.append('platforms', form.platforms.join(','))
      data.append('budget', form.budget || '1000')
      data.append('tone', form.tone)
      data.append('targetAudience', form.targetAudience || 'general consumers')
      data.append('category', form.category)
      photos.forEach(photo => data.append('photos', photo))

      const res = await api.post('/products/marketing', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResults(res.data)
      setStep('results')
      addToast('AI marketing campaign generated successfully!', 'success')
    } catch (err) {
      console.error(err)
      addToast(err.response?.data?.error || 'Failed to generate marketing campaign', 'error')
      setStep('input')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCreateCampaign = () => {
    if (results?.campaign) {
      addToast('Campaign saved. Redirecting to campaigns...', 'success')
      navigate('/dashboard/campaigns')
    }
  }

  const handleSaveAll = () => {
    addToast('All content saved to Content Studio', 'success')
    navigate('/dashboard/content')
  }

  const renderProgress = () => (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900/30" />
        <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
        <Sparkles className="absolute inset-0 m-auto text-blue-600 animate-pulse" size={28} />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Agents are working...</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">Analyzing your product, generating strategy, writing ad copy, crafting social posts, and creating a video script. This takes 15-30 seconds.</p>
      </div>
      <div className="w-full max-w-md space-y-2">
        {[
          'Product Analysis Agent analyzing product and audience...',
          'Campaign Strategy Agent building budget and timeline...',
          'Content Agent writing ad copy and blog post...',
          'Social Media Agent crafting platform-specific posts...',
          'Video Agent creating video ad script...',
          'SEO Agent optimizing keywords and metadata...',
        ].map((text, i) => (
          <div key={i} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${i < 3 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
              {i < 3 ? <Check size={12} /> : <Loader2 size={12} className="animate-spin" />}
            </div>
            {text}
          </div>
        ))}
      </div>
    </div>
  )

  const renderResults = () => {
    if (!results) return null
    const { productProfile, campaign, adCopy, socialPosts, videoScript, emailSequence, seoKeywords, productDescription, blogPost } = results

    const tabs = [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
      { id: 'adCopy', label: 'Ad Copy', icon: Megaphone },
      { id: 'social', label: 'Social Posts', icon: Zap },
      { id: 'email', label: 'Email', icon: Mail },
      { id: 'video', label: 'Video Script', icon: Video },
      { id: 'seo', label: 'SEO', icon: Search },
      { id: 'blog', label: 'Blog Post', icon: BookOpen },
    ]

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Marketing Results</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Generated for <span className="font-medium text-gray-900 dark:text-gray-100">{productProfile?.name || form.productName}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreateCampaign} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Check size={16} /> Save Campaign
            </button>
            <button onClick={handleSaveAll} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700">
              <FileText size={16} /> Save All Content
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[300px]">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <ShoppingCart size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{productProfile?.name || form.productName}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{productProfile?.tagline || 'Your AI-generated product profile'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Target Audience</div>
                    <div className="text-gray-900 dark:text-gray-100">{productProfile?.targetAudience || form.targetAudience || 'General consumers'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Category</div>
                    <div className="text-gray-900 dark:text-gray-100 capitalize">{productProfile?.category || form.category}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Price Positioning</div>
                    <div className="text-gray-900 dark:text-gray-100 capitalize">{productProfile?.pricePositioning || 'Mid-range'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Budget</div>
                    <div className="text-gray-900 dark:text-gray-100">${form.budget}</div>
                  </div>
                </div>
                {productProfile?.keyFeatures?.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Key Features</div>
                    <div className="flex flex-wrap gap-2">
                      {productProfile.keyFeatures.map((f, i) => (
                        <span key={i} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded-full font-medium">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {productProfile?.benefits?.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Benefits</div>
                    <div className="flex flex-wrap gap-2">
                      {productProfile.benefits.map((b, i) => (
                        <span key={i} className="px-2.5 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs rounded-full font-medium">{b}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {campaign?.strategy && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Lightbulb size={18} className="text-yellow-500" /> Strategy Overview
                  </h3>
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {typeof campaign.strategy === 'string' ? campaign.strategy : JSON.stringify(campaign.strategy, null, 2)}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'adCopy' && adCopy && (
            <div className="space-y-4">
              {Object.entries(adCopy).map(([platform, copy]) => (
                <div key={platform} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Globe size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">{platform}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(copy, `ad-${platform}`)}
                      className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {copied === `ad-${platform}` ? <Check size={14} /> : <Copy size={14} />}
                      {copied === `ad-${platform}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{copy}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'social' && socialPosts && (
            <div className="space-y-4">
              {Object.entries(socialPosts).map(([platform, post]) => (
                <div key={platform} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">{platform}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(post, `social-${platform}`)}
                      className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {copied === `social-${platform}` ? <Check size={14} /> : <Copy size={14} />}
                      {copied === `social-${platform}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{post}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'email' && emailSequence && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Email Sequence</span>
                </div>
                <button
                  onClick={() => copyToClipboard(emailSequence, 'email')}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {copied === 'email' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'email' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{emailSequence}</p>
            </div>
          )}

          {activeTab === 'video' && videoScript && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Video size={16} className="text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Video Ad Script</span>
                </div>
                <button
                  onClick={() => copyToClipboard(videoScript, 'video')}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {copied === 'video' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'video' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{videoScript}</p>
            </div>
          )}

          {activeTab === 'seo' && seoKeywords && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">SEO Package</span>
                </div>
                <button
                  onClick={() => copyToClipboard(seoKeywords, 'seo')}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {copied === 'seo' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'seo' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{seoKeywords}</p>
            </div>
          )}

          {activeTab === 'blog' && blogPost && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Blog Post</span>
                </div>
                <button
                  onClick={() => copyToClipboard(typeof blogPost === 'string' ? blogPost : blogPost?.content || '', 'blog')}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {copied === 'blog' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'blog' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{typeof blogPost === 'string' ? blogPost : blogPost?.content || ''}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderInput = () => (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Product Marketing</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Upload photos, describe your product, and let AI create a full marketing campaign</p>
      </div>

      {/* Photo Upload */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Image size={18} className="text-gray-400" /> Product Photos
        </h3>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handlePhotoDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
        >
          <Upload className="mx-auto text-gray-400 mb-2" size={28} />
          <p className="text-sm text-gray-600 dark:text-gray-400">Drag & drop photos here, or click to browse</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Up to 10 images (JPG, PNG, WebP)</p>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
        </div>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative group">
                <img src={URL.createObjectURL(photo)} alt="preview" className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                <button
                  onClick={() => removePhoto(idx)}
                  className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voice & Text Description */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FileText size={18} className="text-gray-400" /> Product Description
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleRecording}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isRecording
                ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800'
                : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
            }`}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            {isRecording ? 'Stop Recording' : 'Record Voice Description'}
          </button>
          {isRecording && (
            <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 animate-pulse">
              <span className="w-2 h-2 bg-red-500 rounded-full" /> Recording...
            </span>
          )}
        </div>

        {(transcript || form.description) && (
          <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Transcript:</div>
            {transcript || form.description}
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Or type your description</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
            placeholder="Describe your product, target audience, key features, and what makes it special. For example: 'A wireless charging pad with 3-device support, 15W fast charging, minimalist design, targeting busy professionals aged 25-40.'"
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>
      </div>

      {/* Product Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Tag size={18} className="text-gray-400" /> Product Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Product Name</label>
            <input
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. TurboCharge Pro"
              value={form.productName}
              onChange={e => setForm(prev => ({ ...prev, productName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              value={form.category}
              onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
            >
              {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Target Audience</label>
            <input
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Busy professionals aged 25-40"
              value={form.targetAudience}
              onChange={e => setForm(prev => ({ ...prev, targetAudience: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Budget ($)</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.budget}
              onChange={e => setForm(prev => ({ ...prev, budget: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tone</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              value={form.tone}
              onChange={e => setForm(prev => ({ ...prev, tone: e.target.value }))}
            >
              {tones.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Platform Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Globe size={18} className="text-gray-400" /> Platforms to Market On
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {platforms.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => togglePlatform(id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                form.platforms.includes(id)
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                  : 'bg-white border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={16} />
              {form.platforms.includes(id) && <Check size={14} className="ml-auto" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          AI will analyze your product, generate strategy, write ad copy, create social posts, build a video script, optimize SEO, and draft an email sequence.
        </p>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Sparkles size={18} /> Launch AI Marketing
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {step === 'input' && renderInput()}
      {step === 'processing' && renderProgress()}
      {step === 'results' && renderResults()}
    </div>
  )
}
