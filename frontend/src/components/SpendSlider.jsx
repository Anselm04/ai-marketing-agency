import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

export default function SpendSlider({ compact = false }) {
  const navigate = useNavigate()

  return (
    <div data-spend-slider="managed-paid-ads" className="rounded-lg p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
      <div className="flex items-start gap-3">
        <ShieldCheck size={20} style={{ color: 'var(--gold-bright)' }} />
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Managed paid advertising</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Paid Meta and Google advertising is controlled through the managed-ad workflow. It verifies the real provider account, campaign configuration, account currency and provider-side spend controls before live activation.
          </p>
        </div>
      </div>

      {!compact && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          The older local daily/monthly slider and $49/month add-on model have been retired so there is only one authoritative billing and hard-stop system. Management fees are disclosed by the managed campaign workflow and live launch stays disabled until the provider adapter is certified.
        </p>
      )}

      <button
        type="button"
        onClick={() => navigate('/dashboard/paid-ads')}
        className="mkt-btn mkt-btn-gold min-h-[48px] text-sm font-medium"
        style={{ background: '#c4a35a', color: '#07080b' }}
      >
        Open Paid Advertising Control
      </button>
    </div>
  )
}
