import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Pile, SavedTab } from '../db/types'

interface Props {
  onClose: () => void
  onOpenPile: (id: number) => void
}

type Result =
  | { kind: 'pile'; pile: Pile }
  | { kind: 'tab'; tab: SavedTab; pileName: string }

const MAX_RESULTS = 50

export function CommandPalette({ onClose, onOpenPile }: Props) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const piles = useLiveQuery(() => db.piles.toArray(), [])
  const tabs = useLiveQuery(() => db.tabs.toArray(), [])

  const pileById = useMemo(() => {
    const m: Record<number, Pile> = {}
    for (const p of piles ?? []) if (p.id !== undefined) m[p.id] = p
    return m
  }, [piles])

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    const pileResults: Result[] = []
    const tabResults: Result[] = []

    for (const p of piles ?? []) {
      if (!q || p.name.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))) {
        pileResults.push({ kind: 'pile', pile: p })
      }
    }

    for (const t of tabs ?? []) {
      if (!q || t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)) {
        const pile = pileById[t.pileId]
        tabResults.push({ kind: 'tab', tab: t, pileName: pile?.name ?? '?' })
      }
    }

    pileResults.sort((a, b) => {
      if (a.kind !== 'pile' || b.kind !== 'pile') return 0
      return b.pile.updatedAt - a.pile.updatedAt
    })
    tabResults.sort((a, b) => {
      if (a.kind !== 'tab' || b.kind !== 'tab') return 0
      return b.tab.addedAt - a.tab.addedAt
    })

    return [...pileResults, ...tabResults].slice(0, MAX_RESULTS)
  }, [piles, tabs, pileById, query])

  useEffect(() => {
    setCursor(0)
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-cursor="true"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const choose = (r: Result) => {
    if (r.kind === 'pile') {
      if (r.pile.id !== undefined) onOpenPile(r.pile.id)
    } else {
      void chrome.tabs.create({ url: r.tab.url })
      onClose()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (results.length === 0 ? 0 : (c + 1) % results.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (results.length === 0 ? 0 : (c - 1 + results.length) % results.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[cursor]
      if (r) choose(r)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="palette-input"
          type="text"
          placeholder="Search piles and tabs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {results.length === 0 ? (
          <div className="palette-empty">No matches.</div>
        ) : (
          <ul className="palette-results" ref={listRef}>
            {results.map((r, i) => (
              <li
                key={r.kind === 'pile' ? `p-${r.pile.id}` : `t-${r.tab.id}`}
                data-cursor={i === cursor}
                className="palette-row"
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(r)}
              >
                {r.kind === 'pile' ? (
                  <>
                    <span className="palette-kind">pile</span>
                    <span className="palette-primary">{r.pile.name}</span>
                  </>
                ) : (
                  <>
                    <span className="palette-kind">tab</span>
                    <span className="palette-primary">{r.tab.title}</span>
                    <span className="palette-secondary">{r.pileName}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="palette-hint">↑↓ navigate · Enter open · Esc close</div>
      </div>
    </div>
  )
}
