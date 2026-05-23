// Pro feature: capture a plain-text snapshot of each tab being saved, so the
// page is searchable later via Cmd+K. Permission is requested lazily — the
// 'scripting' permission + <all_urls> host access are listed as OPTIONAL in
// the manifest, so the free-tier install never sees the prompt.

const SNAPSHOT_MAX_BYTES = 50 * 1024 // 50 KB per tab

const SNAPSHOT_PERMS = ['scripting'] as const
const SNAPSHOT_ORIGINS = ['<all_urls>'] as const

export async function hasSnapshotPermission(): Promise<boolean> {
  return chrome.permissions.contains({
    permissions: [...SNAPSHOT_PERMS],
    origins: [...SNAPSHOT_ORIGINS],
  })
}

/**
 * Returns 'granted' only when BOTH the API permission and the host access are
 * granted. Chrome allows users to grant one and deny the other from the
 * permission dialog; without explicit verification a half-grant looks
 * indistinguishable from a full grant but silently breaks captureSnapshot.
 */
export async function requestSnapshotPermission(): Promise<'granted' | 'partial' | 'denied'> {
  const requested = await chrome.permissions.request({
    permissions: [...SNAPSHOT_PERMS],
    origins: [...SNAPSHOT_ORIGINS],
  })
  if (!requested) return 'denied'

  // Belt + suspenders: even when request resolves true, re-query both halves.
  const [hasPerm, hasHost] = await Promise.all([
    chrome.permissions.contains({ permissions: [...SNAPSHOT_PERMS] }),
    chrome.permissions.contains({ origins: [...SNAPSHOT_ORIGINS] }),
  ])
  if (hasPerm && hasHost) return 'granted'
  return 'partial'
}

export async function removeSnapshotPermission(): Promise<void> {
  await chrome.permissions.remove({
    permissions: [...SNAPSHOT_PERMS],
    origins: [...SNAPSHOT_ORIGINS],
  })
}

export async function captureSnapshot(tabId: number): Promise<string | undefined> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body?.innerText ?? '',
    })
    const text = results[0]?.result
    if (typeof text !== 'string' || text.length === 0) return undefined
    if (text.length > SNAPSHOT_MAX_BYTES) {
      return text.slice(0, SNAPSHOT_MAX_BYTES)
    }
    return text
  } catch (err) {
    // Tab might be a chrome:// page or otherwise unscriptable, or the user
    // denied <all_urls> while granting 'scripting'. Log the tabId for support
    // triage — NEVER log the page content / err response (PII leak).
    console.debug(`[tab-piles] snapshot skipped for tab ${tabId}`)
    return undefined
  }
}
