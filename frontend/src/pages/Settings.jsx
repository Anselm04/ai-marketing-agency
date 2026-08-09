import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { User, Globe, Bell, Key, Save } from 'lucide-react'
import api from '../services/api'

export default function Settings() {
  const { user } = useAuth()
  const [profile, setProfile] = useState({ firstName: '', lastName: '', company: '', timezone: 'UTC', language: 'en' })
  const [integrations, setIntegrations] = useState({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user) {
      setProfile({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        company: user.company || '',
        timezone: user.settings?.timezone || 'UTC',
        language: user.settings?.language || 'en',
      })
    }
    api.get('/settings/integrations').then(res => setIntegrations(res.data))
  }, [user])

  const handleSave = async () => {
    await api.patch('/settings/profile', profile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const integrationList = [
    { key: 'openai', name: 'OpenAI', description: 'AI content generation' },
    { key: 'stripe', name: 'Stripe', description: 'Payments & subscriptions' },
    { key: 'tiktok', name: 'TikTok', description: 'Social publishing' },
    { key: 'meta', name: 'Meta Ads', description: 'Facebook & Instagram ads' },
    { key: 'instagram', name: 'Instagram', description: 'Social publishing' },
    { key: 'youtube', name: 'YouTube', description: 'Analytics & publishing' },
    { key: 'shopify', name: 'Shopify', description: 'eCommerce integration' },
    { key: 'googleSearchConsole', name: 'Google Search Console', description: 'SEO analytics' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500 mt-1">Manage your account and integrations</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><User size={18} /> Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={profile.firstName} onChange={e => setProfile({ ...profile, firstName: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={profile.lastName} onChange={e => setProfile({ ...profile, lastName: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={profile.company} onChange={e => setProfile({ ...profile, company: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={profile.timezone} onChange={e => setProfile({ ...profile, timezone: e.target.value })}>
              <option>UTC</option>
              <option>America/New_York</option>
              <option>Europe/London</option>
              <option>Asia/Tokyo</option>
              <option>Pacific/Auckland</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={profile.language} onChange={e => setProfile({ ...profile, language: e.target.value })}>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Save size={16} />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Key size={18} /> Integrations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrationList.map(int => (
            <div key={int.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-900">{int.name}</div>
                <div className="text-xs text-gray-500">{int.description}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${integrations[int.key] ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {integrations[int.key] ? 'Connected' : 'Not configured'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
