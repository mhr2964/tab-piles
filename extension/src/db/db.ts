import Dexie, { type Table } from 'dexie'
import type { Pile, SavedTab } from './types'

// Re-export so callers don't have to dive into ./types
export type { Pile, SavedTab }

export class TabPilesDB extends Dexie {
  piles!: Table<Pile, number>
  tabs!: Table<SavedTab, number>

  constructor() {
    super('tab-piles')
    this.version(1).stores({
      piles: '++id, name, archivedAt, updatedAt, *tags',
      tabs: '++id, pileId, url, title, addedAt',
    })
  }
}

export const db = new TabPilesDB()

export const ACTIVE_PILE_CAP = 10
export const AUTO_ARCHIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000

export function isActive(p: { archivedAt: number }): boolean {
  return p.archivedAt === 0
}

export async function countActivePiles(): Promise<number> {
  return db.piles.where('archivedAt').equals(0).count()
}

export async function updatePile(
  id: number,
  patch: Partial<Pick<Pile, 'name' | 'note' | 'tags'>>,
): Promise<void> {
  await db.piles.update(id, { ...patch, updatedAt: Date.now() })
}

export async function updateTab(
  id: number,
  patch: Partial<Pick<SavedTab, 'note' | 'title'>>,
): Promise<void> {
  const tab = await db.tabs.get(id)
  if (!tab) return
  await db.tabs.update(id, patch)
  // Bump the parent pile's updatedAt so cloud sync notices.
  await db.piles.update(tab.pileId, { updatedAt: Date.now() })
}

export async function unarchivePile(id: number): Promise<void> {
  const now = Date.now()
  await db.piles.update(id, { archivedAt: 0, updatedAt: now })
}

export async function archiveStalePiles(now: number = Date.now()): Promise<number> {
  const threshold = now - AUTO_ARCHIVE_AFTER_MS
  const stale = await db.piles
    .where('archivedAt')
    .equals(0)
    .and((p) => p.updatedAt < threshold)
    .toArray()
  if (stale.length === 0) return 0
  await db.transaction('rw', db.piles, async () => {
    for (const p of stale) {
      if (p.id !== undefined) await db.piles.update(p.id, { archivedAt: now })
    }
  })
  return stale.length
}
