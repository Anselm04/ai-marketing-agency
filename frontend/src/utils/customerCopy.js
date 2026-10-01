/** Customer-facing copy — never expose raw env key names. */
export function needsConfigMessage(platformLabel) {
  const name = platformLabel || 'This platform'
  return `${name} is not configured by your admin yet. You can still generate and copy posts, or paste a token below if you already have one.`
}

export function friendlyPublishMessage(data) {
  if (!data) return 'Could not publish right now.'
  if (data.published) return data.message || 'Published live to the platform.'
  if (data.queued || data.status === 'queued' || /queue/i.test(data.message || '')) {
    return data.message || 'Saved to your publish queue. It will go live once this account has a valid connection — we will not fake a live post.'
  }
  if (data.fallback || data.blocked) {
    return data.message || 'Not published live — connect the platform first, or copy the post and paste it yourself.'
  }
  return data.message || (data.success ? 'Done.' : 'Not published live yet.')
}

export function customerSetupHint(p) {
  if (p?.connected) return null
  if (p?.oauthConfigured) return 'Click Connect to authorize with your own account. Tokens stay private to you.'
  return 'This platform is not configured by your admin yet. Generate posts anytime; live publish needs admin setup or a pasted token.'
}

export function socialBadgeFor(oauthRow, plat) {
  if (oauthRow?.connected || plat?.connected) return { text: 'Connected — ready to publish', color: 'var(--cyan)' }
  if (oauthRow?.oauthConfigured) return { text: 'Ready to connect', color: '#7dcea0' }
  if (oauthRow) return { text: 'Not configured by admin yet', color: '#e6b567' }
  if (plat?.setup) return { text: 'Marked for setup — add a token to publish', color: 'var(--text-dim)' }
  return { text: 'Not connected yet', color: 'var(--text-dim)' }
}
