import { useEffect, useState } from 'react'
import { ANON_LICENSE, type LicenseState } from './types'
import { REVALIDATE_AFTER_MS, getLocalLicense, validateLicense, watchLicense } from './validate'

export function useLicense(): LicenseState {
  const [state, setState] = useState<LicenseState>(ANON_LICENSE)

  useEffect(() => {
    let mounted = true

    void getLocalLicense().then((stored) => {
      if (!mounted) return
      setState(stored)
      // Side panels remount aggressively in Chrome. Only hit the worker if the
      // cached state is genuinely stale — the worker has its own 24h cache anyway,
      // and the extension hammering it on every mount burns goodwill + quota.
      const stale = !stored.cachedAt || Date.now() - stored.cachedAt >= REVALIDATE_AFTER_MS
      if (stale && stored.licenseKey) {
        void validateLicense().then((next) => mounted && setState(next))
      }
    })

    const unsub = watchLicense((s) => mounted && setState(s))
    return () => {
      mounted = false
      unsub()
    }
  }, [])

  return state
}
