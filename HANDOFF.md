# HANDOFF — tab-piles

Forward-looking handoff for the active work-stream on this project. **Overwrite** on each session that touches the work; do not append. History lives in git.

```yaml
last-model: claude-sonnet-5
last-session: 2026-09-05
state: yellow
```

## Next action — user-block (Lemon Squeezy, then CWS)

**Follow `LAUNCH.md` end-to-end.** Day 0 progress as of 2026-09-05:

- ✅ Step 1 (landing live) — `https://tabpiles.pages.dev`
- ✅ Step 3, minus LS wiring (worker deployed) — `https://tab-piles-worker.subtotal.workers.dev`, D1 created + migrated
- ✅ Step 4, minus LS wiring (`WORKER_URL` set in extension; `dist.zip` built and ready)
- ⏳ Step 2 (Lemon Squeezy) — **blocked on you.** Needs your own identity/payout info to sign up; nothing left for a model to drive until you do this. See `Projects/tab-piles-worker/HANDOFF.md` "Next action" for the exact fields to copy back.
- ⏳ Step 5 (CWS submission) — **blocked on you.** $5 one-time dev-console fee needs your payment method. `dist.zip` is already built (`extension/dist.zip`, 94.9 KB) — nothing left to prep, just upload + paste listing copy from `listing/copy.md` and `listing/permissions.md` once you have the account.

Once you hand back LS variant IDs + checkout URLs + API key, the remaining wiring (secret, redeploy worker, redeploy landing) is a single pass.

All in-extension code is feature-complete, smoked, and tested. ~1000 lines of Pro code now have:
- A critic-audit pass with 7 blockers + 10 nits triaged (blockers fixed, pile-id collision deferred to v0.0.2 + documented).
- A Playwright MCP smoke pass confirming gear icon, Settings modal, Pro tier-pill flip, snapshot toggle, tab-note affordances, and palette upgrade nudge.
- A vitest suite (21 tests across extension + worker): tierGate truth tables, validate cache/grace, worker variant→tier + cache TTL.
- A `npm run zip` script that produces `dist.zip` (94 KB) ready for CWS upload.

## Recent context — 2026-05-23 Phase 2-5 shipped

Five phases landed in one session, three new repos created, all builds + typechecks clean.

**Phase 2 — brand mark + icons.** Three offset cards with a folded amber corner, charcoal + #F59E0B palette. `extension/public/icons/icon.svg` is the master; `extension/scripts/rasterize-icons.mjs` uses `sharp` to emit 16/32/48/128 PNGs. Wired into the manifest `icons` + `action.default_icon` blocks. Verified live in chrome://extensions card.

**Phase 3 — CWS listing.** Copy + permission justifications + 5 screenshots at 1280x800, all under `listing/`. Screenshots captured via Playwright MCP from a seeded demo profile (4 active piles with realistic names + tags), framed as centered cards on a soft gradient via injected CSS, post-processed via `extension/scripts/normalize-screenshots.mjs`.

**Phase 4a — landing page.** New repo at `Projects/tab-piles-landing/`. One-page HTML+CSS+vanilla-JS site, no build step. Sections: hero, 3-feature grid, 4-tier pricing, privacy strip, footer + legal stubs. Brand palette matches the extension exactly. Lemon Squeezy overlay buttons wired with placeholder URLs.

**Phase 4b — billing Worker.** New repo at `Projects/tab-piles-worker/`. Cloudflare Workers + D1 + Hono. Endpoints `/health`, `/activate`, `/validate`, `/deactivate`, `/sync`. 24h D1 cache over Lemon Squeezy. Migration `0001_init.sql` creates `validations`, `piles_cloud`, `tombstones`. Typechecks clean.

**Phase 4c — license activation in extension.** Gear icon in side-panel header opens a Settings modal where users paste a key + see their tier. `src/license/validate.ts` talks to the Worker, caches in `chrome.storage.local` with 24h freshness, 14-day offline grace. `useLicense` hook + `isPro()` tier-gate chokepoint.

**Phase 5a — cloud sync.** `src/sync/sync.ts` runs bidirectional LWW sync. Triggers: initial-mount, debounced 5s after `db.piles` writes (via Dexie hooks), and hourly via a service-worker alarm. Lock prevents concurrent runs.

**Phase 5b — per-tab notes.** `SavedTab.note` was already in the schema (pre-existing). Added inline textarea per tab row, Pro-gated for editing. Notes participate in Cmd+K search.

**Phase 5c — snapshot full-text search.** `scripting` permission + `<all_urls>` declared as **optional** so free-tier install stays clean. Pro user toggles capture on in Settings → grants permission → subsequent saves capture `document.body.innerText` (capped at 50 KB) into `SavedTab.snapshot`. Cmd+K palette gets a `page` result kind that surfaces ±30 chars of context around matches.

## Verify the extension loaded (first step every session)

1. `mcp__playwright-tabpiles__browser_navigate` → `chrome://extensions`. Expect "Tab Piles" card with the amber stacked-cards mark.
2. Read extension ID from the card. Same `--user-data-dir` gives the same ID across sessions; 2026-05-23 ID was `nbddndiaihohcpamcanhohfjkbjhgmkh`.
3. After clicking "Reload" on the card, Chrome may auto-disable the extension and surface "Turn on developer mode." Flip the toggle back on; the extension re-enables and the new bundle loads.

## Smoke checklist (current — works through Phase 1)

The Pro paths (Phase 4c-5c) cannot be smoked end-to-end without a deployed Worker. The free-tier paths still pass:

1. Open two arbitrary URLs.
2. Open `chrome-extension://<id>/src/popup/popup.html`. Save → confirm tab closes after ~800ms.
3. Open `chrome-extension://<id>/src/sidepanel/sidepanel.html`. Confirm the pile appears in Active.
4. Toggle Archived view — empty state if nothing archived. Toggle back.
5. Open the pile. Click the name → edit → Enter. Confirm rename persists.
6. Add a tag → Enter. Confirm chip appears. Click ×.
7. Archive → confirm moves to Archived. Open from Archived. Click "Restore to active."
8. Press Cmd+K → palette opens. Type a tab name → results narrow. ↑↓, Esc.
9. **Gear icon (NEW)** opens Settings. Without a Worker, Activate will fail with a network error — that's the expected user-block state.
10. (Optional) Force auto-archive via DevTools as before.

When the Worker is deployed:
- Paste a real LS license key → tier pill flips to "Pro · Monthly" within 2s.
- Hover a tab row → "+ note" appears. Click → textarea → type → blur. Reload, note persists.
- Cmd+K search a word that's in a note → tab surfaces under the 'tab' kind with the note matched.
- In Settings, "Enable snapshot capture" → Chrome prompts for host permissions → grant. Save a new pile from a real webpage. Cmd+K search a word from that page → 'page' result kind surfaces with the matched excerpt.

## Traps

- **`@playwright/mcp`'s `--extension` flag is boolean.** Path goes through `--config → browser.launchOptions.args: ["--load-extension=<dist>"]`.
- **MV3 service worker terminates when idle.** `chrome.commands.onCommand`, `chrome.alarms.onAlarm`, and `chrome.runtime.onMessage` listeners live at top level of `src/background/index.ts` so the SW wakes for them.
- **Dexie `null` is not indexable.** Schema uses `archivedAt: 0` for active, `archivedAt: <timestamp>` for archived.
- **Free tier soft cap (`ACTIVE_PILE_CAP = 10`) is load-bearing.** Cap meter + popup warn use it. Pro tier does NOT remove the cap in code — the upgrade decision is to add `if (isPro(license)) skip cap` if the Pro plan promises "no cap." Currently the cap meter shows for everyone.
- **`chrome.action.openPopup` requires a real user gesture.** Playwright can't drive it. Open `popup.html` as a tab to exercise the same React tree.
- **`window.close()` in the popup is a no-op when popup is loaded as a tab.** It closes the test tab — fine for smoke.
- **`suggested_key` updates only apply on first install / version bump.** Changing a shortcut in `manifest.config.ts` won't re-bind on existing installs.
- **`chrome.alarms` minimum delay is 30s for packed extensions.** Don't write tests that expect sub-30s firing.
- **Optional permissions don't survive reload of unpacked extension on some Chrome versions.** When testing snapshot capture, you may need to re-grant after each `npm run build` + reload.
- **`WORKER_URL` is a placeholder.** Until set, all `/validate`, `/activate`, `/deactivate`, `/sync` calls will fail. Free tier paths are unaffected.
- **License cache key is `tab-piles:license` in `chrome.storage.local`.** Sync cursor is `tab-piles:sync-cursor`. Don't reuse those keys.
- **Sync uses LWW on client clock.** Document trap: clocks skewed >5 minutes between user devices can lose writes silently. Acceptable for v1 Pro.
- **Chrome Web Store first review can take 5-7 days.** Submit early.

## Do not touch

- `extension/dist/` — generated by `npm run build`. Never hand-edit.
- `extension/public/icons/icon-*.png` — generated by `extension/scripts/rasterize-icons.mjs`. Edit `icon.svg` and regenerate.

---

When the work-stream is done (extension live in CWS, Worker deployed, landing live, first paid customer), **delete this file**.
