import { useEffect, useRef, useState } from 'react'
import { activateLicense, deactivateLicense } from '../license/validate'
import { isPro, tierLabel } from '../lib/tierGate'
import {
  hasSnapshotPermission,
  removeSnapshotPermission,
  requestSnapshotPermission,
} from '../lib/snapshots'
import type { LicenseState } from '../license/types'

interface Props {
  license: LicenseState
  onClose: () => void
}

export function Settings({ license, onClose }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshotsOn, setSnapshotsOn] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    void hasSnapshotPermission().then(setSnapshotsOn)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggleSnapshots = async () => {
    setBusy(true)
    setError(null)
    try {
      if (snapshotsOn) {
        await removeSnapshotPermission()
        setSnapshotsOn(false)
      } else {
        const status = await requestSnapshotPermission()
        if (status === 'granted') {
          setSnapshotsOn(true)
        } else if (status === 'partial') {
          // User granted one half (likely 'scripting') but denied the other (<all_urls>).
          // Roll back to a clean state so we don't keep half-permissions live.
          await removeSnapshotPermission()
          setSnapshotsOn(false)
          setError('Snapshot search needs BOTH the scripting permission AND read access to the pages you save. The partial grant was rolled back — try again and accept both.')
        } else {
          setSnapshotsOn(false)
          setError('Permission denied. Snapshot search needs read access to capture page text.')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const activate = async () => {
    setBusy(true)
    setError(null)
    try {
      await activateLicense(draft)
      setDraft('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const deactivate = async () => {
    if (!confirm('Deactivate this device? You can re-paste the key to reactivate.')) return
    setBusy(true)
    setError(null)
    try {
      await deactivateLicense()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const activeLicense = license.licenseKey && license.valid
  const expiryLabel = license.expiresAt
    ? `Renews ${new Date(license.expiresAt).toLocaleDateString()}`
    : license.tier === 'lifetime'
      ? 'No expiry — yours forever'
      : null

  return (
    <div className="palette-backdrop" onClick={onClose} role="dialog" aria-label="Settings">
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>Settings</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <section className="settings-section">
          <h3>License</h3>
          <p className="tier-pill" data-pro={isPro(license)}>
            {tierLabel(license.tier)}
          </p>

          {activeLicense ? (
            <>
              <p className="settings-detail">
                Key <code>{maskKey(license.licenseKey!)}</code>
                {expiryLabel ? ` · ${expiryLabel}` : ''}
              </p>
              <button type="button" className="settings-danger" onClick={deactivate} disabled={busy}>
                {busy ? 'Working…' : 'Deactivate this device'}
              </button>
              <p className="micro">
                Frees a license slot. You can re-activate this device anytime by re-pasting the key.
              </p>
            </>
          ) : (
            <>
              <label className="settings-label" htmlFor="license-input">
                Paste your license key
              </label>
              <input
                id="license-input"
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void activate()
                }}
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                disabled={busy}
              />
              <button
                type="button"
                className="settings-primary"
                onClick={activate}
                disabled={busy || !draft.trim()}
              >
                {busy ? 'Activating…' : 'Activate'}
              </button>
              <p className="micro">
                No license yet? <a href="https://tabpiles.pages.dev#pricing" target="_blank" rel="noreferrer">See Pro pricing</a>.
              </p>
            </>
          )}

          {error && <p className="settings-error">{error}</p>}
        </section>

        <section className="settings-section">
          <h3>Snapshot search {!isPro(license) && <span className="pro-tag">Pro</span>}</h3>
          <p className="micro">
            Capture a plain-text snapshot of each page when you save a pile, so you can Cmd+K search across the actual content of pages — not just their titles. Requires read access to the pages you save.
          </p>
          {isPro(license) ? (
            <button
              type="button"
              className={snapshotsOn ? 'settings-danger' : 'settings-primary'}
              onClick={toggleSnapshots}
              disabled={busy}
              style={{ marginTop: 8 }}
            >
              {busy ? 'Working…' : snapshotsOn ? 'Disable snapshot capture' : 'Enable snapshot capture'}
            </button>
          ) : (
            <a
              className="settings-primary"
              style={{ marginTop: 8, display: 'block', textAlign: 'center', textDecoration: 'none' }}
              href="https://tabpiles.pages.dev#pricing"
              target="_blank"
              rel="noreferrer"
            >
              Upgrade to enable
            </a>
          )}
        </section>

        <section className="settings-section">
          <h3>About</h3>
          <p className="micro">
            Tab Piles v{chrome.runtime.getManifest().version}
            <br />
            Issues, ideas, or feature requests: <a href="mailto:tabpiles.support@gmail.com">tabpiles.support@gmail.com</a>
          </p>
        </section>
      </div>
    </div>
  )
}

function maskKey(key: string): string {
  if (key.length <= 8) return key
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}
