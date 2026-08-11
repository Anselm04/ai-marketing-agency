import { useEffect, useState } from 'react'
import { Users, Plus, Trash2, Shield, User, CheckCircle, XCircle, Copy } from 'lucide-react'
import api from '../services/api'

export default function Team() {
  const [org, setOrg] = useState(null)
  const [invites, setInvites] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchOrg = async () => {
    try {
      const res = await api.get('/team/org')
      setOrg(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load organization')
    }
  }

  const fetchInvites = async () => {
    try {
      const res = await api.get('/team/invites')
      setInvites(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchOrg()
    fetchInvites()
  }, [])

  const handleInvite = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await api.post('/team/invites', { email, role })
      setSuccess(`Invite sent to ${email}.`)
      setEmail('')
      fetchInvites()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invite')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (userId) => {
    if (!confirm('Remove this member?')) return
    try {
      await api.delete(`/team/members/${userId}`)
      fetchOrg()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member')
    }
  }

  const handleChangeRole = async (userId, newRole) => {
    try {
      await api.patch(`/team/members/${userId}`, { role: newRole })
      fetchOrg()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update role')
    }
  }

  const isOwner = org?.members?.find(m => m.userId === org?.ownerId)?.userId === org?.ownerId
  const currentUserRole = org?.members?.find(m => m.userId === org?.ownerId)?.role

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Team</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your organization and invite team members</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg">{success}</div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Organization</h3>
        {org ? (
          <div className="space-y-2">
            <div className="text-sm text-gray-600 dark:text-gray-300">Name: <span className="font-medium text-gray-900 dark:text-white">{org.name}</span></div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Members: <span className="font-medium text-gray-900 dark:text-white">{org.members.length}</span></div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Loading...</div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Invite Member</h3>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            placeholder="colleague@company.com"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <select
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={role}
            onChange={e => setRole(e.target.value)}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={16} />
            {loading ? 'Sending...' : 'Invite'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Members</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {org?.members.map(member => (
            <div key={member.userId} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
                  {(member.name || member.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{member.name || member.email}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  member.role === 'owner' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                  member.role === 'admin' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                  'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {member.role}
                </span>
                {org.ownerId === member.userId ? (
                  <Shield size={16} className="text-purple-500" />
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      value={member.role}
                      onChange={e => handleChangeRole(member.userId, e.target.value)}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={() => handleRemove(member.userId)}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {(!org || org.members.length === 0) && (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No members yet</div>
          )}
        </div>
      </div>

      {invites.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Pending Invites</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {invites.map(invite => (
              <div key={invite.id} className="p-4 flex items-center justify-between">
                <div className="text-sm text-gray-900 dark:text-white">{invite.email}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{invite.role}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
