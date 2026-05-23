import type { LicenseState, Tier } from '../license/types'

export function isPro(state: LicenseState | null | undefined): boolean {
  if (!state || !state.valid) return false
  return state.tier === 'monthly' || state.tier === 'yearly' || state.tier === 'lifetime'
}

export function tierLabel(tier: Tier): string {
  switch (tier) {
    case 'monthly': return 'Pro · Monthly'
    case 'yearly': return 'Pro · Yearly'
    case 'lifetime': return 'Pro · Lifetime'
    case 'free': return 'Free'
  }
}
