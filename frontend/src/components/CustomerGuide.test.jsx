import { describe, expect, it } from 'vitest'
import { getCustomerGuide } from './CustomerGuide'

describe('customer self-service guidance', () => {
  it('explains how a vague customer can confirm business requirements', () => {
    const guide = getCustomerGuide('/dashboard/onboarding')
    expect(guide.title).toMatch(/business/i)
    expect(guide.steps.some(([title]) => /summary/i.test(title))).toBe(true)
  })

  it('keeps paid advertising behind customer authorisation', () => {
    const guide = getCustomerGuide('/dashboard/paid-ads')
    expect(guide.steps.some(([, detail]) => /explicit authorisation/i.test(detail))).toBe(true)
  })

  it('provides safe guidance even on other dashboard pages', () => {
    expect(getCustomerGuide('/dashboard/settings').steps.length).toBeGreaterThan(0)
  })

  it('does not mistake another path for the campaign page', () => {
    expect(getCustomerGuide('/dashboard/campaigns-other').title).toBe('Find your way around')
  })
})
