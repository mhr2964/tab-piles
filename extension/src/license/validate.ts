import { ANON_LICENSE, type LicenseState, type Tier } from './types'
import { STORAGE_LICENSE } from '../lib/storageKeys'

// USER: set after worker deploy. Until then license activation will fail with
// a network error and the extension stays on the free tier. That's the safe
// default — no Pro features are gated yet anyway.
export const WORKER_URL = 'https://tab-piles-worker.subtotal.workers.dev'

// Mount-side mirror of the worker's cache window. The worker is the source of
// truth; this constant just tells `useLicense` when to bother re-asking the
// worker (avoids hammering on every side-panel re-mount).
export const REVALIDATE_AFTER_MS = 24 * 60 * 60 * 1000

// If the worker is unreachable AND the last successful validation was within
// this window, treat the cached state as still authoritative — don't drop
// paying users to Free because their network blinked.
const OFFLINE_GRACE_MS = 14 * 24 * 60 * 60 * 1000

// DEV ESCAPE HATCH for local Pro-feature smoke without standing up the worker.
// Paste into DevTools console on the side-panel page:
//
//   chrome.storage.local.set({ 'tab-piles:license': {
//     licenseKey: 'DEV', instanceId: 'DEV', tier: 'lifetime',
//     valid: true, cachedAt: Date.now(), expiresAt: null,
//   }})
//
// The extension treats this as Pro · Lifetime. Cloud sync will fail against the
// placeholder WORKER_URL — that's expected; UI shells are exercisable anyway.

interface ActivateResponse {
  valid: boolean
  tier?: Tier
  expiresAt?: number | null
  instanceId?: string
  cachedAt?: number
  error?: string
}

async function readStored(): Promise<LicenseState> {
  const out = await chrome.storage.local.get(STORAGE_LICENSE)
  return (out[STORAGE_LICENSE] as LicenseState | undefined) ?? ANON_LICENSE
}

async function writeStored(state: LicenseState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_LICENSE]: state })
}

async function postWorker(path: '/activate' | '/validate' | '/deactivate', body: object): Promise<ActivateResponse> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`worker ${path} ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as ActivateResponse
}

export async function activateLicense(licenseKey: string): Promise<LicenseState> {
  const trimmed = licenseKey.trim()
  if (!trimmed) throw new Error('License key cannot be empty.')

  const platform = await chrome.runtime.getPlatformInfo().catch(() => ({ os: 'unknown' }))
  const instanceName = `Tab Piles · ${platform.os}`

  const res = await postWorker('/activate', { licenseKey: trimmed, instanceName })
  if (!res.valid || !res.instanceId || !res.tier) {
    throw new Error(res.error || 'License could not be activated.')
  }

  const state: LicenseState = {
    licenseKey: trimmed,
    instanceId: res.instanceId,
    tier: res.tier,
    valid: true,
    expiresAt: res.expiresAt ?? null,
    cachedAt: res.cachedAt ?? Date.now(),
  }
  await writeStored(state)
  return state
}

export async function validateLicense(now: number = Date.now()): Promise<LicenseState> {
  const stored = await readStored()
  if (!stored.licenseKey || !stored.instanceId) return ANON_LICENSE

  // No client-side cache short-circuit. The worker holds the authoritative 24h
  // cache; stacking another 24h here would mean a refunded / chargebacked /
  // disabled license keeps Pro access for up to 48h. Always ask the worker.
  try {
    const res = await postWorker('/validate', {
      licenseKey: stored.licenseKey,
      instanceId: stored.instanceId,
    })
    const next: LicenseState = {
      licenseKey: stored.licenseKey,
      instanceId: stored.instanceId,
      tier: res.tier ?? 'free',
      valid: !!res.valid,
      expiresAt: res.expiresAt ?? null,
      cachedAt: res.cachedAt ?? now,
    }
    await writeStored(next)
    return next
  } catch (err) {
    // Network/server failure. Offline-grace path: if the last successful validation
    // was <14 days ago, treat the cached state as still authoritative.
    if (stored.valid && stored.cachedAt && now - stored.cachedAt < OFFLINE_GRACE_MS) {
      return stored
    }
    return { ...stored, valid: false, tier: 'free' }
  }
}

export async function deactivateLicense(): Promise<LicenseState> {
  const stored = await readStored()
  if (!stored.licenseKey || !stored.instanceId) return ANON_LICENSE
  try {
    await postWorker('/deactivate', {
      licenseKey: stored.licenseKey,
      instanceId: stored.instanceId,
    })
  } catch (err) {
    // Slice the error string defensively — LS error messages occasionally echo
    // request params, and we don't want full keys winding up in extension logs.
    console.warn('[tab-piles] worker deactivate failed; clearing locally anyway:', String(err).slice(0, 200))
  }
  await writeStored(ANON_LICENSE)
  return ANON_LICENSE
}

export async function getLocalLicense(): Promise<LicenseState> {
  return readStored()
}

export function watchLicense(cb: (state: LicenseState) => void): () => void {
  const handler = (changes: { [k: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local') return
    if (!(STORAGE_LICENSE in changes)) return
    cb((changes[STORAGE_LICENSE]?.newValue as LicenseState | undefined) ?? ANON_LICENSE)
  }
  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}
