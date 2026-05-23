import { describe, expect, it } from 'vitest'
import { getEffectiveCap, isPro, tierLabel } from './tierGate'
import { ANON_LICENSE, type LicenseState } from '../license/types'
import { ACTIVE_PILE_CAP } from '../db/db'

function L(over: Partial<LicenseState>): LicenseState {
  return { ...ANON_LICENSE, ...over }
}

describe('isPro', () => {
  it('false for null / undefined / anonymous', () => {
    expect(isPro(null)).toBe(false)
    expect(isPro(undefined)).toBe(false)
    expect(isPro(ANON_LICENSE)).toBe(false)
  })

  it('false for valid:false even with paid tier (revoked Pro)', () => {
    expect(isPro(L({ tier: 'lifetime', valid: false }))).toBe(false)
    expect(isPro(L({ tier: 'monthly', valid: false }))).toBe(false)
  })

  it('false for free tier even if valid:true (anon edge)', () => {
    expect(isPro(L({ tier: 'free', valid: true }))).toBe(false)
  })

  it('true for each paid tier when valid', () => {
    expect(isPro(L({ tier: 'monthly', valid: true }))).toBe(true)
    expect(isPro(L({ tier: 'yearly', valid: true }))).toBe(true)
    expect(isPro(L({ tier: 'lifetime', valid: true }))).toBe(true)
  })
})

describe('getEffectiveCap', () => {
  it('returns ACTIVE_PILE_CAP for free / anon / null', () => {
    expect(getEffectiveCap(null)).toBe(ACTIVE_PILE_CAP)
    expect(getEffectiveCap(ANON_LICENSE)).toBe(ACTIVE_PILE_CAP)
    expect(getEffectiveCap(L({ tier: 'free', valid: true }))).toBe(ACTIVE_PILE_CAP)
  })

  it('returns null (no cap) for valid Pro tiers', () => {
    expect(getEffectiveCap(L({ tier: 'monthly', valid: true }))).toBeNull()
    expect(getEffectiveCap(L({ tier: 'lifetime', valid: true }))).toBeNull()
  })

  it('returns cap when paid tier is invalid (e.g. expired)', () => {
    expect(getEffectiveCap(L({ tier: 'monthly', valid: false }))).toBe(ACTIVE_PILE_CAP)
  })
})

describe('tierLabel', () => {
  it('renders human-friendly labels', () => {
    expect(tierLabel('free')).toBe('Free')
    expect(tierLabel('monthly')).toBe('Pro · Monthly')
    expect(tierLabel('yearly')).toBe('Pro · Yearly')
    expect(tierLabel('lifetime')).toBe('Pro · Lifetime')
  })
})
