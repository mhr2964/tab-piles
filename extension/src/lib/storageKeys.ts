// Single source of truth for chrome.storage and Web Locks keys.
// Hardcoding these strings in two files invites collision bugs.

export const STORAGE_LICENSE = 'tab-piles:license'
export const STORAGE_SYNC_CURSOR = 'tab-piles:sync-cursor'

// navigator.locks key. NOT a chrome.storage key — used by the Web Locks API
// to serialize sync runs across side-panel + service-worker contexts.
export const LOCK_SYNC = 'tab-piles:sync-lock'
