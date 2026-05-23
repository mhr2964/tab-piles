// Cloud sync engine. Pro-gated. Last-write-wins by pile.updatedAt.
//
// Algorithm:
//   1. Read local cursor (last serverNow we successfully synced).
//   2. Collect every local pile (with its tabs) where updatedAt > cursor.
//   3. POST { piles, deletions: [] } to /sync; receive { serverNow, piles: [], tombstones: [] }.
//   4. For each returned pile: upsert if remote.updatedAt > local.updatedAt; else skip.
//   5. For each tombstone: delete the local pile if it still exists.
//   6. Persist cursor = serverNow.
//
// We do NOT delete piles locally today — archive sets archivedAt but the row stays. So
// the deletions[] upload is always empty. The tombstone DOWNLOAD path is still wired
// for future use (true-delete UI, or admin/server-side purges).

import { db } from '../db/db'
import type { Pile, SavedTab } from '../db/types'
import { ANON_LICENSE, type LicenseState } from '../license/types'
import { WORKER_URL } from '../license/validate'
import { isPro } from '../lib/tierGate'

const CURSOR_KEY = 'tab-piles:sync-cursor'
const LOCK_KEY = 'tab-piles:sync-lock'
const LOCK_TTL_MS = 30_000

interface SyncCursor {
  serverNow: number
}

interface CloudPilePayload {
  pile: Pile
  tabs: SavedTab[]
}

interface SyncResponse {
  serverNow: number
  piles: Array<{ id: number; data: CloudPilePayload; updatedAt: number }>
  tombstones: number[]
}

export interface SyncResult {
  ok: boolean
  pushed: number
  pulled: number
  tombstoned: number
  error?: string
}

async function readCursor(): Promise<number> {
  const out = await chrome.storage.local.get(CURSOR_KEY)
  return (out[CURSOR_KEY] as SyncCursor | undefined)?.serverNow ?? 0
}

async function writeCursor(serverNow: number): Promise<void> {
  await chrome.storage.local.set({ [CURSOR_KEY]: { serverNow } })
}

async function acquireLock(now: number): Promise<boolean> {
  const out = await chrome.storage.local.get(LOCK_KEY)
  const existing = out[LOCK_KEY] as { ts: number } | undefined
  if (existing && now - existing.ts < LOCK_TTL_MS) return false
  await chrome.storage.local.set({ [LOCK_KEY]: { ts: now } })
  return true
}

async function releaseLock(): Promise<void> {
  await chrome.storage.local.remove(LOCK_KEY)
}

export async function runSync(license: LicenseState): Promise<SyncResult> {
  if (!isPro(license) || !license.licenseKey || !license.instanceId) {
    return { ok: false, pushed: 0, pulled: 0, tombstoned: 0, error: 'pro license required' }
  }

  const now = Date.now()
  const gotLock = await acquireLock(now)
  if (!gotLock) {
    return { ok: false, pushed: 0, pulled: 0, tombstoned: 0, error: 'sync already in progress' }
  }

  try {
    const cursor = await readCursor()

    // Local → server: piles updated since the cursor.
    const localPiles = await db.piles.where('updatedAt').above(cursor).toArray()
    const uploads: Array<{ id: number; data: CloudPilePayload; updatedAt: number }> = []
    for (const pile of localPiles) {
      if (pile.id === undefined) continue
      const tabs = await db.tabs.where('pileId').equals(pile.id).toArray()
      uploads.push({ id: pile.id, data: { pile, tabs }, updatedAt: pile.updatedAt })
    }

    const res = await fetch(`${WORKER_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: license.licenseKey,
        instanceId: license.instanceId,
        sinceMs: cursor,
        piles: uploads,
        deletions: [],
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`/sync ${res.status}: ${text.slice(0, 200)}`)
    }
    const payload = (await res.json()) as SyncResponse

    // Server → local: apply downloads. LWW on updatedAt.
    let pulled = 0
    await db.transaction('rw', db.piles, db.tabs, async () => {
      for (const remote of payload.piles) {
        const local = await db.piles.get(remote.id)
        if (local && local.updatedAt >= remote.updatedAt) continue
        const { pile, tabs } = remote.data
        // Force-set the id to match the remote canonical id.
        await db.piles.put({ ...pile, id: remote.id })
        await db.tabs.where('pileId').equals(remote.id).delete()
        for (const t of tabs) {
          const { id: _drop, ...rest } = t
          await db.tabs.add({ ...rest, pileId: remote.id })
        }
        pulled++
      }

      for (const id of payload.tombstones) {
        await db.tabs.where('pileId').equals(id).delete()
        await db.piles.delete(id)
      }
    })

    await writeCursor(payload.serverNow)
    return { ok: true, pushed: uploads.length, pulled, tombstoned: payload.tombstones.length }
  } catch (err) {
    return { ok: false, pushed: 0, pulled: 0, tombstoned: 0, error: (err as Error).message }
  } finally {
    await releaseLock()
  }
}

export async function resetSyncCursor(): Promise<void> {
  await chrome.storage.local.remove(CURSOR_KEY)
}

export function watchPileWrites(cb: () => void): () => void {
  const onCreate = () => cb()
  const onUpdate = () => cb()
  const onDelete = () => cb()
  db.piles.hook('creating', onCreate)
  db.piles.hook('updating', onUpdate)
  db.piles.hook('deleting', onDelete)
  return () => {
    db.piles.hook('creating').unsubscribe(onCreate)
    db.piles.hook('updating').unsubscribe(onUpdate)
    db.piles.hook('deleting').unsubscribe(onDelete)
  }
}

// Light dependency-free debounce, scoped to a single caller.
export function makeDebouncedSync(license: () => LicenseState, delayMs = 5_000): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void runSync(license())
    }, delayMs)
  }
}

export { ANON_LICENSE }
