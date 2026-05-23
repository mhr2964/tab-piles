# HANDOFF — tab-piles

Forward-looking handoff for the active work-stream on this project. **Overwrite** on each session that touches the work; do not append. History lives in git.

```yaml
last-model: claude-opus-4-7
last-session: 2026-05-23
state: green
```

## Next action

Phase 1 (in-browser feature work) is complete and live-smoked. Remaining v1 work is presentation + distribution:

1. **Icons.** Manifest declares no `icons` block; Chrome shows default puzzle-piece. Generate 16/32/48/128 PNGs and wire into `manifest.config.ts` before any CWS submission. Brand has a name ("Tab Piles") + tagline ("Drop a research thread, pick it up next Tuesday") but no visual identity yet.
2. **Chrome Web Store listing prep.** Short description (132 char), detailed description, category, screenshots (1280×800 or 640×400, 1–5), privacy notice + per-permission justification (`tabs`, `storage`, `sidePanel`, `unlimitedStorage`, `alarms`). First review takes 5–7 days — submit early.
3. **Landing + billing (Phase 3).** Recommended: Cloudflare Pages for the landing page, LemonSqueezy/Paddle for billing (Merchant-of-Record beats Stripe at this price point — no EU VAT to handle). License key entry in the side-panel settings, validated against a CF Workers endpoint, cached for 24h. No login required for the free tier.
4. **Pro tier (Phase 4, deferred).** Cloud sync (CF Workers + D1), per-tab notes, full-text page-snapshot search. Do not build until at least a few people have paid for the lifetime tier.

## Recent context — 2026-05-23 Phase 1a + 1b shipped

All seven features landed and live-smoked in one session, zero console errors at end of run:

**Phase 1a (UX gaps a real beta user would have hit):**
- **Archived view.** `view: 'active' | 'archived'` toggle in side-panel header. Both counts (`Active (N)` / `Archived (M)`) wired to live queries.
- **Tag editor in PileDetail.** Chip list with × to remove, input with Enter/comma to add, Backspace on empty input removes the last tag. Persists via `updatePile(id, { tags })` which bumps `updatedAt`.
- **Click-to-rename pile heading.** Click name → input (auto-focused + selected). Enter or blur saves, Esc cancels. Empty/unchanged names are ignored.
- **Unarchive button.** When `pile.archivedAt > 0`, the Archive button is replaced by "Restore to active" — `unarchivePile(id)` zeroes `archivedAt` and bumps `updatedAt`.

**Phase 1b (v1 feature scope from prior sessions):**
- **Cmd+K command palette.** Modal overlay over `SidePanelApp`. Listens for Cmd+K / Ctrl+K at the window level. Mixed pile + tab results (each tab shows its parent pile name). ↑↓ wrapping navigation, Enter selects, Esc closes, click-on-row selects. Selecting a pile opens it; selecting a tab opens it in a new browser tab.
- **Auto-archive at 30 days.** `chrome.alarms` daily alarm (`tab-piles:auto-archive`, `periodInMinutes: 1440`), created in both `onInstalled` and `onStartup`. Handler calls `archiveStalePiles()` which queries `db.piles.where('archivedAt').equals(0).and(p => p.updatedAt < now - 30d)` and stamps `archivedAt = now`. End-to-end verified in smoke by backdating a pile + forcing the alarm.

**Schema/helpers:**
- `updatePile(id, patch)`, `unarchivePile(id)`, `archiveStalePiles(now?)`, and constant `AUTO_ARCHIVE_AFTER_MS` all live in `extension/src/db/db.ts`.
- `alarms` permission added to manifest.

**Manifest shortcuts — partial:**
- `Ctrl+Shift+S` (save current window) — registered, working.
- `Ctrl+Shift+L` (`_execute_action`) — registered, working.
- `Alt+Shift+P` (open side panel) — initially had `Ctrl+Shift+P` which Chrome reserves for its devtools command bar; switched to `Alt+Shift+P` in manifest. Chrome **does not auto-apply a new `suggested_key` on extension reload** (only on first install or version bump), so existing installs will show "Not set" — users bind it manually at `chrome://extensions/shortcuts`. Documented as expected behavior.

## Verify the extension loaded (first step every session)

1. `mcp__playwright-tabpiles__browser_navigate` → `chrome://extensions`. Expect "Tab Piles" card.
2. Read extension ID from the card. 2026-05-23 ID was `nbddndiaihohcpamcanhohfjkbjhgmkh` — same `--user-data-dir` should yield the same ID across sessions, but verify.
3. **After clicking in-page "Reload" on the Tab Piles card, Chrome may auto-disable the extension and surface "Turn on developer mode" — even though dev mode appeared on a moment earlier.** Click the Developer mode toggle in the header to flip it back on; the extension re-enables and the new bundle loads. This happened cleanly on 2026-05-23 with no IndexedDB loss.

## Smoke checklist (current — verified passing 2026-05-23)

1. Open two arbitrary URLs.
2. Open `chrome-extension://<id>/src/popup/popup.html` in a tab (toolbar popup itself isn't programmatically openable without a user gesture). Save → confirm tab closes after ~800ms.
3. Open `chrome-extension://<id>/src/sidepanel/sidepanel.html`. Confirm the new pile appears in Active and the cap meter increments.
4. **Toggle Archived view** — empty state if nothing archived; otherwise the archived pile list. Toggle back to Active.
5. Open the pile. **Click the name** → edit → Enter. Confirm rename persists.
6. **Add a tag** via the tag input → Enter. Confirm chip appears. Click × on the chip → confirm removal.
7. Archive the pile → confirm it moves to Archived. Open it from Archived. Click "Restore to active" → confirm it moves back.
8. Press **Cmd+K (or Ctrl+K)** → palette opens. Type a tab name → results narrow. Press ↑↓ to navigate. Press Esc → closes.
9. (Optional) Force auto-archive: in DevTools on the side panel, backdate a pile's `updatedAt` to 31 days ago via IndexedDB, then `chrome.alarms.create('tab-piles:auto-archive', { delayInMinutes: 1/60, periodInMinutes: 1440 })`. Wait ~35s. Confirm pile auto-archives. (Chrome enforces a 30s minimum alarm delay for packed extensions.)

If any step fails, check `chrome://extensions` → Tab Piles → "Inspect views: service worker" for errors. After a rebuild (`npm run build`), reload the extension card so the new bundle loads.

## Traps

- **`@playwright/mcp`'s `--extension` flag is a boolean, not a path.** It means "connect to a running browser via the official Playwright Extension companion app." Path-to-extension goes through `--config` → `browser.launchOptions.args: ["--load-extension=<dist>"]`.
- **Native OS folder picker can't be automated.** That's why we auto-load via `--load-extension`.
- **MV3 service worker terminates when idle.** `chrome.commands.onCommand` and `chrome.alarms.onAlarm` listeners at top level of `src/background/index.ts` wake it. Don't move them inside async init blocks.
- **Dexie `null` is not indexable.** Schema uses `archivedAt: 0` for active and `archivedAt: <timestamp>` for archived.
- **Free tier soft cap is load-bearing.** `ACTIVE_PILE_CAP = 10` in `src/db/db.ts`. Cap meter and popup warn use it.
- **`chrome.action.openPopup` requires a real user gesture** — Playwright can't drive it. Open `popup.html` as a tab to exercise the same React tree + message contract.
- **`window.close()` in the popup is a no-op when popup is loaded as a tab.** It closes the tab instead — fine for smoke, expected for real popup use.
- **`suggested_key` updates only apply on first install / version bump.** Changing a shortcut in `manifest.config.ts` won't re-bind on existing installs; users must rebind manually.
- **`chrome.alarms` minimum delay is 30s for packed extensions** (warning in unpacked, hard floor in packed). Don't write tests that expect sub-30s firing.
- **Chrome Web Store first review can take 5–7 days.** Submit early.

## Do not touch

- `extension/dist/` — generated by `npm run build`. Never hand-edit.

---

When the work-stream is done, **delete this file** (don't leave a stale "complete" handoff lying around). The git history holds the record.
