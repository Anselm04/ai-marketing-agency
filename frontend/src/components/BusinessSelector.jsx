import { Building2, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useBusiness } from '../context/BusinessContext'

export default function BusinessSelector({ allowAll = true, className = '' }) {
  const {
    businesses,
    selectedBusinessId,
    setSelectedBusinessId,
    loadingBusinesses,
  } = useBusiness()

  const changeBusiness = (event) => {
    setSelectedBusinessId(event.target.value)
    window.location.reload()
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Building2 size={16} className="text-blue-600 dark:text-blue-400" />
      <label className="text-sm text-gray-600 dark:text-gray-300" htmlFor="business-workspace-select">Business</label>
      <select
        id="business-workspace-select"
        value={selectedBusinessId}
        disabled={loadingBusinesses}
        onChange={changeBusiness}
        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
      >
        {allowAll && <option value="">All businesses</option>}
        {!allowAll && <option value="">Choose a business</option>}
        {businesses.map((business) => (
          <option key={business.id} value={business.id}>{business.name || business.company || 'Unnamed business'}</option>
        ))}
      </select>
      <Link to="/dashboard/onboarding" className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">
        <Plus size={14} /> Add/manage
      </Link>
    </div>
  )
}
