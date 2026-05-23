# CWS Listing Assets — index

Everything needed for a Chrome Web Store submission lives in this folder. Paste copy from `copy.md`, per-permission justifications from `permissions.md`, and upload the screenshots in order.

## Files

- **`copy.md`** — listing name, short description (132 char), detailed description (full marketing copy), privacy notice. Paste each into the matching CWS dev-console field.
- **`permissions.md`** — one justification per declared permission (`tabs`, `storage`, `sidePanel`, `unlimitedStorage`, `alarms`, and `scripting` for Phase 5c).
- **`screenshots/`** — 5 PNGs at 1280x800.

## Screenshot order

| # | File | What it shows |
|---|------|---------------|
| 1 | `cws-1-hero.png` | Side panel with 4 active piles, tags + cap meter — the at-a-glance hero |
| 2 | `cws-2-detail.png` | Pile detail with chip-style tag editor + tab list |
| 3 | `cws-3-palette.png` | Cmd+K command palette mid-search, mixed pile+tab results |
| 4 | `cws-4-archived.png` | Archived view toggled on, showing 3 archived piles |
| 5 | `cws-5-popup.png` | Toolbar popup save-to-pile flow |

## How these were captured

- `extension/scripts/normalize-screenshots.mjs` composites raw browser captures onto a 1280x800 background with a soft gradient + amber-tinted radial accent so the side panel reads as a centered card.
- A CSS frame is injected at capture time (`max-width: 420px`, `border-radius: 14px`, `box-shadow`) so the side panel looks like a polished surface rather than the raw 380px-wide native panel.
- The screenshots were taken from a seeded demo profile with realistic pile names and tab titles (granular synthesis, launch prep, NBA bot, wedding venues).

## Pre-submit checklist (user)

1. Sign in to the Chrome Web Store dev console ($5 one-time reg fee if not already done).
2. Create a new item, upload `extension/dist.zip` (build via `cd extension && npm run build && cd dist && zip -r ../dist.zip .`).
3. Paste listing fields from `copy.md` and `permissions.md`.
4. Upload all 5 screenshots from `screenshots/`.
5. Set category to **Productivity**.
6. Submit. Expect 5-7 day review SLA.
7. While waiting: line up the landing page (`Projects/tab-piles-landing/`) and billing worker (`Projects/tab-piles-worker/`) — both already scaffolded, just need user-supplied LemonSqueezy + Cloudflare credentials before going live.
