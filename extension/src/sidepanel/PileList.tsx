import type { Pile } from '../db/types'
import { saveCurrentWindowAsPile } from '../lib/capture'

interface Props {
  piles: Pile[]
  tabCounts: Record<number, number>
  view: 'active' | 'archived'
  onOpen: (id: number) => void
}

export function PileList({ piles, tabCounts, view, onOpen }: Props) {
  if (piles.length === 0) {
    if (view === 'archived') {
      return (
        <div className="empty">
          <p>No archived piles.</p>
        </div>
      )
    }
    return (
      <div className="empty">
        <p>No piles yet.</p>
        <button
          type="button"
          onClick={() => {
            saveCurrentWindowAsPile().catch(console.error)
          }}
        >
          Save this window as a pile
        </button>
      </div>
    )
  }

  return (
    <ul className="pile-list">
      {piles.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            className="pile-row"
            onClick={() => p.id !== undefined && onOpen(p.id)}
          >
            <div className="pile-name">{p.name}</div>
            {p.tags.length > 0 && (
              <div className="pile-tags">
                {p.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="pile-meta">
              {tabLabel(p.id !== undefined ? tabCounts[p.id] ?? 0 : 0)} · {relTime(p.updatedAt)}
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

function tabLabel(n: number): string {
  return n === 1 ? '1 tab' : `${n} tabs`
}

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
