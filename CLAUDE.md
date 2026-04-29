# pharmaceutical.audio — CLAUDE.md

## What this is
The record label site for `pharmaceutical.audio`, plus the Trespasser event page. Static HTML only, no build step, no scrapers, no API endpoints, no automation. Eden hand-edits this site directly.

## Design language
@~/code/design-language.md

## Tech stack
- **Host:** Cloudflare Pages, project `pharmaceutical-audio-label`. Auto-deploys on `main` push.
- **Repo:** `github.com/edengrill/pharmaceutical-audio-label`. Local working tree at `~/code/pharmaceutical-audio-label/`.
- **Build:** static for everything except the store. The store page is generated at deploy time by `build-store.mjs` (Node, single dependency: `stripe`).
- **Branch:** `main` (note: the worldwide site uses `master` — different branches per repo).

## File map
- `index.html` — homepage. Three nav links: pharmaceutical audio (label) + trespasser (event) + store.
- `audio.html` — the label / catalog landing page.
- `albums.html`, `eps.html`, `singles.html`, `mixes.html` — catalog views.
- `trespasser.html` — single event page for the Trespasser event series.
- `trespasser_assets/` — image and asset directory for the trespasser page.
- `store.html` — store catalog. Hand-written chrome; product cards generated at build time from Stripe between `<!-- BUILD products -->` markers.
- `store/thanks.html` — post-purchase success page; Stripe Checkout redirects here.
- `build-store.mjs` — Stripe → HTML build script. Runs at deploy time on Cloudflare Pages.
- `package.json` — declares the single `stripe` dependency and the `build` script.

## Core rules
- **Inherit the shared design language** (imported above). Black on white, lowercase, Helvetica, 0.78rem default, generous padding, no decoration.
- **No runtime backend** — no API endpoints on the live site, no admin UI, no automation that runs in front of users. The shop's "backend" is Stripe; the build step just compiles their data into static HTML.
- **No external dependencies in the served HTML** — no JS frameworks, no CSS frameworks, no analytics, no fonts, no third-party scripts on any page. Inline `<style>` only. (Build-time deps in `package.json` are fine; they don't ship to the browser.)
- **Public site stays 100% static at runtime.** Everything resolves to static files. The `build-store.mjs` step runs before deploy, never per-request.
- **Don't introduce a runtime admin UI.** Eden manages products in the Stripe iOS app; the deploy hook + iOS Shortcut acts as the "publish" button. Any new admin feature should be questioned hard.

## Store: how it works
- Eden adds/edits/archives products in the Stripe Dashboard (iOS app or web).
- Product `metadata.size` and `metadata.inquire_only` (`"true"` for halo items) drive the rendering; `metadata.order` (integer, lower first) controls sort order. The script populates `metadata.payment_link` and `metadata.payment_link_price` automatically — do not edit those by hand.
- Eden taps the "publish store" iOS Shortcut on his phone, which POSTs to a Cloudflare deploy hook. Cloudflare runs `npm install && node build-store.mjs`, which fetches active products from Stripe, ensures each non-inquire product has a current Stripe Payment Link, and rewrites `store.html` with the rendered cards.
- For inquire-only items the script renders a `mailto:store@pharmaceutical.audio` link. For direct-sale items it renders a link to the product's Stripe Payment Link, which redirects to `https://pharmaceutical.audio/store/thanks` after purchase.
- If `STRIPE_SECRET_KEY` is missing or Stripe is unreachable, the script logs and writes an empty product list, so the rest of the site still deploys.

## Cloudflare Pages config
- **Build command:** `npm install && node build-store.mjs`
- **Output directory:** `.` (default — repo root)
- **Env vars:** `STRIPE_SECRET_KEY` = `sk_live_…` (encrypted/secret). Use `sk_test_…` while testing.
- **Deploy hook:** one named "publish store"; URL bookmarked into the iOS Shortcut.

## Context: the 2026-04-28 split
This repo was split off from the worldwide directory on 2026-04-28. The worldwide events directory now lives at `~/code/worldwwwide/` (separate repo: `github.com/edengrill/worldwwwide`). The two products are fully independent — separate domains, separate Cloudflare projects, separate codebases — but share the same design language via the import above.

## Deploys
Push to `main` → Cloudflare auto-deploys → live at `pharmaceutical.audio` ~30 seconds later. There's no staging environment; commits to main go to production.

## Open / planned
- The site is intentionally minimal. New pages added on demand as the catalog grows.
- No automation planned. If something starts to feel automate-able, that's probably the wrong instinct for this site.
