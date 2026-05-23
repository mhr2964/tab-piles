// Pro feature: capture a plain-text snapshot of each tab being saved, so the
// page is searchable later via Cmd+K. Permission is requested lazily — the
// 'scripting' permission + <all_urls> host access are listed as OPTIONAL in
// the manifest, so the free-tier install never sees the prompt.

const SNAPSHOT_MAX_BYTES = 50 * 1024 // 50 KB per tab

export async function hasSnapshotPermission(): Promise<boolean> {
  return chrome.permissions.contains({
    permissions: ['scripting'],
    origins: ['<all_urls>'],
  })
}

export async function requestSnapshotPermission(): Promise<boolean> {
  return chrome.permissions.request({
    permissions: ['scripting'],
    origins: ['<all_urls>'],
  })
}

export async function removeSnapshotPermission(): Promise<void> {
  await chrome.permissions.remove({
    permissions: ['scripting'],
    origins: ['<all_urls>'],
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
  } catch {
    // Tab might be a chrome:// page or otherwise unscriptable. Silently skip.
    return undefined
  }
}
