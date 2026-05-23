import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANON_LICENSE, type LicenseState } from './types'

// Minimal chrome.storage shim — single in-memory record at the license key.
function makeChromeStub() {
  let store: Record<string, unknown> = {}
  return {
    storage: {
      local: {
        get: vi.fn(async (k: string) => ({ [k]: store[k] })),
        set: vi.fn(async (kv: Record<string, unknown>) => Object.assign(store, kv)),
        remove: vi.fn(async (k: string) => { delete store[k] }),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      getPlatformInfo: vi.fn(async () => ({ os: 'win' })),
    },
    _peek: () => store,
    _reset: () => { store = {} },
  }
}

let chromeStub: ReturnType<typeof makeChromeStub>

beforeEach(() => {
  chromeStub = makeChromeStub()
  vi.stubGlobal('chrome', chromeStub)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

const proLicense: LicenseState = {
  licenseKey: 'KEY-123',
  instanceId: 'INST-abc',
  tier: 'lifetime',
  valid: true,
  expiresAt: null,
  cachedAt: 0,
}

describe('validateLicense — offline grace', () => {
  it('returns ANON_LICENSE when no license is stored', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { validateLicense } = await import('./validate')
    const out = await validateLicense(1_000)
    expect(out).toEqual(ANON_LICENSE)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps Pro state when worker fails and last validation was <14d ago', async () => {
    const now = 1_000_000_000
    const cachedAt = now - 10 * 24 * 60 * 60 * 1000 // 10d old
    await chromeStub.storage.local.set({
      'tab-piles:license': { ...proLicense, cachedAt },
    })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    const { validateLicense } = await import('./validate')
    const out = await validateLicense(now)
    expect(out.valid).toBe(true)
    expect(out.tier).toBe('lifetime')
    expect(out.cachedAt).toBe(cachedAt) // didn't bump
  })

  it('drops to free when worker fails and grace window expired (>14d)', async () => {
    const now = 1_000_000_000
    const cachedAt = now - 20 * 24 * 60 * 60 * 1000 // 20d old
    await chromeStub.storage.local.set({
      'tab-piles:license': { ...proLicense, cachedAt },
    })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    const { validateLicense } = await import('./validate')
    const out = await validateLicense(now)
    expect(out.valid).toBe(false)
    expect(out.tier).toBe('free')
  })

  it('uses worker response when reachable (no client-side cache short-circuit)', async () => {
    const now = 1_000_000_000
    await chromeStub.storage.local.set({
      'tab-piles:license': { ...proLicense, cachedAt: now - 1000 }, // fresh by old logic
    })
    const json = {
      valid: true,
      tier: 'yearly',
      expiresAt: now + 86_400_000,
      instanceId: 'INST-abc',
      cachedAt: now,
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => json, text: async () => '',
    })))
    const { validateLicense } = await import('./validate')
    const out = await validateLicense(now)
    expect(fetch).toHaveBeenCalledTimes(1) // critic fix: no client-side cache skip
    expect(out.tier).toBe('yearly')
    expect(out.expiresAt).toBe(json.expiresAt)
  })
})

describe('deactivateLicense', () => {
  it('clears local state even if worker call fails', async () => {
    await chromeStub.storage.local.set({ 'tab-piles:license': proLicense })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom') }))
    // Suppress the expected console.warn so the test output stays clean.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deactivateLicense } = await import('./validate')
    const out = await deactivateLicense()
    expect(out).toEqual(ANON_LICENSE)
    expect(chromeStub._peek()['tab-piles:license']).toEqual(ANON_LICENSE)
    warn.mockRestore()
  })
})
