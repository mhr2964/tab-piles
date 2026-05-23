import { useEffect, useState } from 'react'
import { ANON_LICENSE, type LicenseState } from './types'
import { getLocalLicense, validateLicense, watchLicense } from './validate'

export function useLicense(): LicenseState {
  const [state, setState] = useState<LicenseState>(ANON_LICENSE)

  useEffect(() => {
    let mounted = true
    void getLocalLicense().then((s) => mounted && setState(s))
    void validateLicense().then((s) => mounted && setState(s))
    const unsub = watchLicense((s) => mounted && setState(s))
    return () => {
      mounted = false
      unsub()
    }
  }, [])

  return state
}
