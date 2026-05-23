# Tab Piles — Launch Checklist

One canonical path from "today" to "first paying user." Each step lists the
**you-do** action, the **command-to-run** (where applicable), and which
per-repo `HANDOFF.md` to consult for substeps.

The realistic critical-path time below assumes you've never touched any of
the host accounts. If you already have Cloudflare / Lemon Squeezy / a CWS
dev account, cut each step roughly in half.

---

## Day 0 (~3 hours hands-on, then 5–7 day wait)

### Step 1 — Cloudflare Pages: landing live (~30 min)

- Create a [Cloudflare](https://dash.cloudflare.com/) account if you don't have one.
- Pages → "Create project" → "Connect to Git". Point at the
  `tab-piles-landing` repo. Build command: *(empty)*. Output dir: `src`.
- Name the project `tabpiles` so the auto-subdomain becomes
  `tabpiles.pages.dev`. (The code references this URL throughout.)
- Hit deploy. Smoke: `npm start` from `Projects/tab-piles-landing/` for a
  local preview before pushing if you want a sanity pass first.
- Set the "Last updated" date in `src/legal/privacy.html` and
  `src/legal/terms.html` (search for `USER: set on first publish`).

**Detail:** `Projects/tab-piles-landing/HANDOFF.md`

### Step 2 — Lemon Squeezy: products + license keys (~30 min)

- Sign up at [Lemon Squeezy](https://www.lemonsqueezy.com/). MoR billing,
  handles VAT/sales tax for you (~5%+0.50 fee).
- Create three products:
  - `tab-piles-monthly` ($5/mo, recurring)
  - `tab-piles-yearly` ($40/yr, recurring)
  - `tab-piles-lifetime` ($79 one-time)
- On EVERY variant: enable the "License Keys" add-on and set
  `activation_limit: 5`. (This is the device cap. Without it, one license
  works on unlimited devices.)
- From Settings → API: generate an API key with read+write on licenses.
  Save it — you'll paste it in step 3.
- Copy each variant ID + each public checkout URL.

### Step 3 — Cloudflare Worker: license validation + sync (~60 min)

- From `Projects/tab-piles-worker/`:
  - `npm install`
  - `npx wrangler d1 create tab-piles` → paste the returned `database_id`
    into `wrangler.toml`.
  - Paste the three LS variant IDs from step 2 into `wrangler.toml`'s
    `[vars]` block (`LS_VARIANT_MONTHLY`, `LS_VARIANT_YEARLY`,
    `LS_VARIANT_LIFETIME`).
  - `npx wrangler secret put LS_API_KEY` and paste the LS API key.
  - `npm run migrate:remote` to apply the D1 schema.
  - `npm run deploy`. Worker URL will be
    `https://tab-piles-worker.<your-account>.workers.dev`.
- Verify it: `npm run verify https://tab-piles-worker.<your-account>.workers.dev`
  — script checks `/health` + does an expect-fail `/activate` to confirm LS
  is wired.

**Detail:** `Projects/tab-piles-worker/HANDOFF.md`

### Step 4 — Wire the placeholders (~15 min)

- **Extension** `extension/src/license/validate.ts`: set `WORKER_URL` to
  the deployed worker URL from step 3.
- **Landing** `tab-piles-landing/src/main.js`: paste the LS checkout URLs
  from step 2 into the three `LS_OVERLAY_URLS` entries.
- Push the landing commit. CF Pages auto-rebuilds.

### Step 5 — CWS submission (~30 min)

- Sign up at [CWS dev console](https://chrome.google.com/webstore/devconsole)
  ($5 one-time reg fee).
- From `Projects/tab-piles/extension/`: `npm run zip` → produces
  `dist.zip` (one command, no manual zipping).
- New item → upload `dist.zip`.
- Paste fields from `Projects/tab-piles/listing/copy.md` (name, short
  description, detailed description, privacy notice, homepage URL).
- Paste justifications from `Projects/tab-piles/listing/permissions.md`.
- Upload all 5 screenshots from `Projects/tab-piles/listing/screenshots/`.
- Category: Productivity. Submit.

**Detail:** `Projects/tab-piles/listing/listing.md`

---

## Day 1–7 — Wait for CWS review

5–7 days typical SLA. No action required. While you wait:

- Set up `tabpiles.support@gmail.com` (free Gmail) — it's the support
  address baked into the privacy + terms pages.
- Decide on launch posts: r/chrome_extensions, r/productivity, Product
  Hunt, HN Show. Draft them now so you can paste-and-go on approval day.

---

## Day ~7 — CWS approves; soft launch

- Copy the live CWS extension URL.
- **Landing** `tab-piles-landing/src/main.js`: set `CWS_URL` to the live
  CWS URL. Push.
- **Worker** `tab-piles-worker/wrangler.toml`: tighten `ALLOWED_ORIGINS`
  from `chrome-extension://*` to the specific published extension id
  (`chrome-extension://<the-id>`). Redeploy. Without this, ANY installed
  Chrome extension can call your worker — a soft security issue, not
  technically broken but worth closing.
- Soft launch: post to r/chrome_extensions + r/productivity. Aim for
  visibility-not-volume.

---

## Day 14+ — Pile up first signals

- Watch the first 100 installs roll in. The free tier should "just work"
  with zero support email.
- First Pro purchase test: buy your own lifetime license, paste into
  Settings, confirm tier flips to "Pro · Lifetime" and Settings shows
  the snapshot toggle. Try snapshot capture on one page. Sanity check
  cloud sync between two profiles.
- Add Plausible to the landing (privacy-respecting analytics, no cookies)
  if you want install-funnel numbers. Update the privacy stub if you do —
  the language already mentions "if we ever add basic page-view counting."

---

## Post-launch backlog (NOT day-0 critical)

- Custom domain — `tabpiles.app` if available, point it at the same CF
  Pages project. Update CORS allow-list. Update support email to
  `support@tabpiles.app` via CF Email Routing (free with domain).
- Pile-id collision fix (v0.0.2) — see `extension/src/sync/sync.ts` for
  the known limitation block. Cross-device LWW on autoincrement IDs can
  silently destroy data when two devices independently create piles
  while offline. Fix is `crypto.randomUUID()`-keyed sync.
- Firefox / Edge ports — separate submissions, different review cycles.
- Onboarding tour in-extension.
- Referral / affiliate program via Lemon Squeezy.

---

## Files this checklist touches

```
Projects/tab-piles-landing/src/main.js                  (CWS_URL, LS_OVERLAY_URLS)
Projects/tab-piles-landing/src/legal/privacy.html       (Last updated date)
Projects/tab-piles-landing/src/legal/terms.html         (Last updated date)
Projects/tab-piles-worker/wrangler.toml                 (database_id, LS_VARIANT_*, ALLOWED_ORIGINS)
Projects/tab-piles/extension/src/license/validate.ts    (WORKER_URL)
```

Plus the live secrets you don't store in code:

```
wrangler secret put LS_API_KEY        (Lemon Squeezy API key)
LS dashboard                          (activation_limit, License Keys add-on)
CF Pages dashboard                    (project name = tabpiles)
CWS dev console                       (listing fields, screenshots, zip upload)
```
