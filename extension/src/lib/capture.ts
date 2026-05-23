import { db } from '../db/db'

export interface CaptureResult {
  pileId: number
  tabCount: number
  capExceeded: boolean
}

export function isCapturableUrl(url?: string | null): url is string {
  if (!url) return false
  return !url.startsWith('chrome://') && !url.startsWith('chrome-extension://')
}

export async function saveCurrentWindowAsPile(name?: string): Promise<CaptureResult> {
  const windowId = (await chrome.windows.getCurrent()).id
  if (windowId === undefined) throw new Error('No current window')

  const tabs = await chrome.tabs.query({ windowId })
  const now = Date.now()

  const activeCount = await db.piles.where('archivedAt').equals(0).count()
  const capExceeded = activeCount >= 10

  const pileName = name?.trim() || defaultPileName(tabs.length, now)

  const pileId = await db.piles.add({
    name: pileName,
    note: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
    archivedAt: 0,
  })

  const savedTabs = tabs
    .filter((t): t is chrome.tabs.Tab & { url: string } => isCapturableUrl(t.url))
    .map((t) => ({
      pileId,
      url: t.url,
      title: t.title ?? t.url,
      favIconUrl: t.favIconUrl,
      addedAt: now,
    }))

  if (savedTabs.length > 0) await db.tabs.bulkAdd(savedTabs)

  return { pileId, tabCount: savedTabs.length, capExceeded }
}

function defaultPileName(count: number, ts: number): string {
  const d = new Date(ts)
  const stamp = `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${count} tabs · ${stamp}`
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
