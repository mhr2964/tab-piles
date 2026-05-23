import { useEffect } from 'react'
import type { LicenseState } from '../license/types'
import { isPro } from '../lib/tierGate'
import { makeDebouncedSync, runSync, watchPileWrites } from './sync'

export function useSync(license: LicenseState): void {
  useEffect(() => {
    if (!isPro(license)) return

    void runSync(license)

    const debounced = makeDebouncedSync(() => license)
    const unsubWrites = watchPileWrites(debounced)

    return () => {
      unsubWrites()
    }
  }, [license.licenseKey, license.instanceId, license.tier, license.valid])
}
