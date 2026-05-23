import type { LicenseState, Tier } from '../license/types'
import { ACTIVE_PILE_CAP } from '../db/db'

export function isPro(state: LicenseState | null | undefined): boolean {
  if (!state || !state.valid) return false
  return state.tier === 'monthly' || state.tier === 'yearly' || state.tier === 'lifetime'
}

/**
 * Pro users have no soft cap; free users hit ACTIVE_PILE_CAP. Returns null
 * for "no limit" so callers can render `Active: N` instead of `N / 10`.
 */
export function getEffectiveCap(state: LicenseState | null | undefined): number | null {
  return isPro(state) ? null : ACTIVE_PILE_CAP
}

export function tierLabel(tier: Tier): string {
  switch (tier) {
    case 'monthly': return 'Pro · Monthly'
    case 'yearly': return 'Pro · Yearly'
    case 'lifetime': return 'Pro · Lifetime'
    case 'free': return 'Free'
  }
}

export const UPGRADE_URL = 'https://tabpiles.pages.dev#pricing'
