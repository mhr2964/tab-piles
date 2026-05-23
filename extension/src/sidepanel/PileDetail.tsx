import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updatePile, unarchivePile } from '../db/db'

interface Props {
  pileId: number
  onBack: () => void
}

export function PileDetail({ pileId, onBack }: Props) {
  const pile = useLiveQuery(() => db.piles.get(pileId), [pileId])
  const tabs = useLiveQuery(
    () => db.tabs.where('pileId').equals(pileId).sortBy('addedAt'),
    [pileId],
  )

  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const renameInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming && renameInput.current) {
      renameInput.current.focus()
      renameInput.current.select()
    }
  }, [renaming])

  if (!pile) return <div className="empty">Loading…</div>

  const isArchived = pile.archivedAt > 0

  const restoreAll = async () => {
    if (!tabs || tabs.length === 0) return
    await chrome.windows.create({ url: tabs.map((t) => t.url) })
  }

  const archive = async () => {
    await db.piles.update(pileId, { archivedAt: Date.now() })
    onBack()
  }

  const unarchive = async () => {
    await unarchivePile(pileId)
  }

  const startRename = () => {
    setDraftName(pile.name)
    setRenaming(true)
  }

  const commitRename = async () => {
    const next = draftName.trim()
    if (next && next !== pile.name) {
      await updatePile(pileId, { name: next })
    }
    setRenaming(false)
  }

  const cancelRename = () => {
    setRenaming(false)
  }

  const addTag = async () => {
    const t = tagDraft.trim().toLowerCase()
    if (!t) return
    if (pile.tags.includes(t)) {
      setTagDraft('')
      return
    }
    await updatePile(pileId, { tags: [...pile.tags, t] })
    setTagDraft('')
  }

  const removeTag = async (t: string) => {
    await updatePile(pileId, { tags: pile.tags.filter((x) => x !== t) })
  }

  return (
    <div className="pile-detail">
      <button type="button" className="back" onClick={onBack}>
        ← Back
      </button>

      {renaming ? (
        <input
          ref={renameInput}
          className="rename-input"
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commitRename()
            if (e.key === 'Escape') cancelRename()
          }}
        />
      ) : (
        <h2
          className="pile-title"
          title="Click to rename"
          onClick={startRename}
        >
          {pile.name}
        </h2>
      )}

      <div className="tag-editor">
        {pile.tags.map((t) => (
          <span key={t} className="tag tag-removable">
            {t}
            <button
              type="button"
              className="tag-remove"
              aria-label={`Remove ${t}`}
              onClick={() => removeTag(t)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="tag-input"
          type="text"
          placeholder="Add tag…"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              void addTag()
            }
            if (e.key === 'Backspace' && tagDraft === '' && pile.tags.length > 0) {
              void removeTag(pile.tags[pile.tags.length - 1])
            }
          }}
          onBlur={() => {
            if (tagDraft.trim()) void addTag()
          }}
        />
      </div>

      <div className="actions">
        <button type="button" onClick={restoreAll} disabled={!tabs?.length}>
          Restore all ({tabs?.length ?? 0})
        </button>
        {isArchived ? (
          <button type="button" onClick={unarchive}>
            Restore to active
          </button>
        ) : (
          <button type="button" onClick={archive}>
            Archive
          </button>
        )}
      </div>

      <ul className="tab-list">
        {tabs?.map((t) => (
          <li key={t.id}>
            <a href={t.url} target="_blank" rel="noreferrer">
              {t.favIconUrl && <img src={t.favIconUrl} alt="" width={16} height={16} />}
              <span>{t.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
