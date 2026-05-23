import { useEffect, useRef } from 'react'
import type { LicenseState } from '../license/types'
import { isPro } from '../lib/tierGate'
import { makeDebouncedSync, runSync, watchPileWrites } from './sync'

export function useSync(license: LicenseState): void {
  // Keep a ref to the latest license so the debounced sync always reads the freshest
  // state without re-subscribing hooks every time validateLicense() updates the cache.
  const licenseRef = useRef(license)
  licenseRef.current = license

  // Gate effect on the STABLE identity of the license (key+instance). license.valid,
  // license.tier, license.cachedAt all flip on every 24h revalidation — keying on
  // them re-subscribes Dexie hooks + re-fires runSync on every cache refresh.
  const key = license.licenseKey ?? ''
  const inst = license.instanceId ?? ''

  useEffect(() => {
    if (!isPro(licenseRef.current)) return

    void runSync(licenseRef.current)

    const debounced = makeDebouncedSync(() => licenseRef.current)
    const unsubWrites = watchPileWrites(debounced)

    return () => {
      unsubWrites()
    }
  }, [key, inst])
}
