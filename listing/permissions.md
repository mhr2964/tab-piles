# Tab Piles — Per-Permission Justifications

CWS reviewers require a justification field per permission. Paste each into the matching field at submit time.

## `tabs`

> To read the URL, title, and favicon of every tab in the current window when the user saves a pile, and to open tabs in a new window when the user restores a pile. Tab Piles does not read tab contents.

## `storage`

> To remember user preferences across sessions: which view (Active or Archived) was last selected, which pile was last opened, and (in the Pro tier) the user's license-key validation cache.

## `sidePanel`

> The main UI is a Chrome side panel. This permission is required to open the side panel programmatically when the user invokes the keyboard shortcut or clicks the toolbar icon.

## `unlimitedStorage`

> Piles can accumulate over time, and the Pro tier stores optional page-text snapshots for full-text search. Both can exceed Chrome's default ~5 MB storage quota for a heavy user. `unlimitedStorage` lets the user keep all their piles indefinitely without storage-quota errors.

## `alarms`

> To run a daily background check that moves piles untouched for 30+ days from "Active" to "Archived". This keeps the active pile list focused on current work without losing old piles, and runs once per day with no other use of `alarms`.

## `scripting` *(only after Phase 5c snapshot search ships)*

> To capture a text-only snapshot of a page when a Pro user saves a tab, so the page can be searched later via the in-extension full-text search. The snapshot is plain text only (no scripts, no DOM), capped at 50 KB per page, and stored locally on the user's machine. Used only when the user is on the Pro tier and only at save time.
