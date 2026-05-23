import { useEffect, useState } from 'react'
import { isCapturableUrl, saveCurrentWindowAsPile } from '../lib/capture'

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; tabCount: number; capExceeded: boolean }
  | { kind: 'error'; message: string }

export function Popup() {
  const [name, setName] = useState('')
  const [tabCount, setTabCount] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    chrome.windows.getCurrent({ populate: true }).then((w) => {
      const capturable = (w.tabs ?? []).filter((t) => isCapturableUrl(t.url))
      setTabCount(capturable.length)
    })
  }, [])

  const save = async () => {
    setStatus({ kind: 'saving' })
    try {
      const result = await saveCurrentWindowAsPile(name)
      setStatus({ kind: 'saved', tabCount: result.tabCount, capExceeded: result.capExceeded })
      setTimeout(() => window.close(), 800)
    } catch (err) {
      setStatus({ kind: 'error', message: String(err) })
    }
  }

  const openSidePanel = async () => {
    const win = await chrome.windows.getCurrent()
    if (win.id !== undefined) await chrome.sidePanel.open({ windowId: win.id })
    window.close()
  }

  return (
    <div className="popup">
      <header>
        <h1>Save to pile</h1>
        <button type="button" className="link" onClick={openSidePanel}>
          Open piles →
        </button>
      </header>

      <p className="hint">
        {tabCount === null
          ? 'Counting tabs…'
          : tabCount === 1
            ? '1 tab will be saved'
            : `${tabCount} tabs will be saved`}
      </p>

      <input
        type="text"
        placeholder="Pile name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
        }}
        autoFocus
      />

      <button
        type="button"
        className="primary"
        onClick={save}
        disabled={status.kind === 'saving' || status.kind === 'saved'}
      >
        {status.kind === 'saving' ? 'Saving…' : status.kind === 'saved' ? 'Saved' : 'Save window'}
      </button>

      {status.kind === 'saved' && status.capExceeded && (
        <p className="warn">Past the 10-pile free cap — archive an old pile to keep it tidy.</p>
      )}

      {status.kind === 'error' && <p className="warn">{status.message}</p>}
    </div>
  )
}
