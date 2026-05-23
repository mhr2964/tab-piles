export type Tier = 'free' | 'monthly' | 'yearly' | 'lifetime'

export interface LicenseState {
  licenseKey: string | null
  instanceId: string | null
  tier: Tier
  valid: boolean
  cachedAt: number
  expiresAt: number | null
}

export const ANON_LICENSE: LicenseState = {
  licenseKey: null,
  instanceId: null,
  tier: 'free',
  valid: false,
  cachedAt: 0,
  expiresAt: null,
}
