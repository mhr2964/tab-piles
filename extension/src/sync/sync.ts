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
//
// KNOWN LIMITATION (v0.0.2 fix): pile.id is a local autoincrement, so two devices that
// both create a pile while offline can collide on id, and LWW silently destroys the
// loser. Probability is near-zero at v1 launch (no Pro users yet); fix is to add
// crypto.randomUUID() as a clientUuid column and key sync by that instead of pile.id.

import { db } from '../db/db'
import type { Pile, SavedTab } from '../db/types'
import { ANON_LICENSE, type LicenseState } from '../license/types'
import { WORKER_URL } from '../license/validate'
import { isPro } from '../lib/tierGate'
import { LOCK_SYNC, STORAGE_SYNC_CURSOR } from '../lib/storageKeys'

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
  const out = await chrome.storage.local.get(STORAGE_SYNC_CURSOR)
  return (out[STORAGE_SYNC_CURSOR] as SyncCursor | undefined)?.serverNow ?? 0
}

async function writeCursor(serverNow: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_SYNC_CURSOR]: { serverNow } })
}

async function syncBody(license: LicenseState): Promise<SyncResult> {
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
}

export async function runSync(license: LicenseState): Promise<SyncResult> {
  if (!isPro(license) || !license.licenseKey || !license.instanceId) {
    return { ok: false, pushed: 0, pulled: 0, tombstoned: 0, error: 'pro license required' }
  }

  // Use the Web Locks API rather than a chrome.storage TOCTOU latch. `ifAvailable:true`
  // returns null when another holder has the lock — perfect for "skip if already running".
  // Web Locks is process-wide for service workers + same-origin documents (side panel),
  // so this serializes across the alarm and the side-panel-mounted instance.
  const result = await navigator.locks.request(
    LOCK_SYNC,
    { ifAvailable: true },
    async (lock) => {
      if (!lock) {
        return { ok: false, pushed: 0, pulled: 0, tombstoned: 0, error: 'sync already in progress' } as SyncResult
      }
      try {
        return await syncBody(license)
      } catch (err) {
        return { ok: false, pushed: 0, pulled: 0, tombstoned: 0, error: (err as Error).message } as SyncResult
      }
    },
  )
  return result
}

export async function resetSyncCursor(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_SYNC_CURSOR)
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
