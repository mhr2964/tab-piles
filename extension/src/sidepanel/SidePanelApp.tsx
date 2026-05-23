import { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ACTIVE_PILE_CAP } from '../db/db'
import { PileList } from './PileList'
import { PileDetail } from './PileDetail'
import { CommandPalette } from './CommandPalette'

type View = 'active' | 'archived'

export function SidePanelApp() {
  const [selectedPileId, setSelectedPileId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('active')
  const [paletteOpen, setPaletteOpen] = useState(false)

  const activePiles = useLiveQuery(
    () => db.piles.where('archivedAt').equals(0).reverse().sortBy('updatedAt'),
    [],
  )

  const archivedPiles = useLiveQuery(
    () => db.piles.where('archivedAt').above(0).reverse().sortBy('archivedAt'),
    [],
  )

  const tabCounts = useLiveQuery(async () => {
    const counts: Record<number, number> = {}
    await db.tabs.each((t) => {
      counts[t.pileId] = (counts[t.pileId] ?? 0) + 1
    })
    return counts
  }, [])

  const piles = view === 'active' ? activePiles : archivedPiles

  const filteredPiles = useMemo(() => {
    if (!piles) return []
    const q = query.trim().toLowerCase()
    if (!q) return piles
    return piles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [piles, query])

  const activeCount = activePiles?.length ?? 0
  const archivedCount = archivedPiles?.length ?? 0
  const overCap = activeCount >= ACTIVE_PILE_CAP

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tab Piles</h1>
        <div className="cap-meter" data-over={overCap}>
          {activeCount} / {ACTIVE_PILE_CAP}
        </div>
      </header>

      <div className="view-toggle">
        <button
          type="button"
          data-active={view === 'active'}
          onClick={() => {
            setView('active')
            setSelectedPileId(null)
          }}
        >
          Active ({activeCount})
        </button>
        <button
          type="button"
          data-active={view === 'archived'}
          onClick={() => {
            setView('archived')
            setSelectedPileId(null)
          }}
        >
          Archived ({archivedCount})
        </button>
      </div>

      <div className="app-search">
        <input
          type="search"
          placeholder="Search piles and tabs (Cmd+K)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="app-body">
        {selectedPileId === null ? (
          <PileList
            piles={filteredPiles}
            tabCounts={tabCounts ?? {}}
            view={view}
            onOpen={setSelectedPileId}
          />
        ) : (
          <PileDetail pileId={selectedPileId} onBack={() => setSelectedPileId(null)} />
        )}
      </div>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpenPile={(id) => {
            setSelectedPileId(id)
            setPaletteOpen(false)
          }}
        />
      )}
    </div>
  )
}
