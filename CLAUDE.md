# pharmaceutical.audio — CLAUDE.md

## What this is
The record label site for `pharmaceutical.audio`, plus the Trespasser event page. Static HTML only, no build step, no scrapers, no API endpoints, no automation. Eden hand-edits this site directly.

## Design language
@~/code/design-language.md

## Tech stack
- **Host:** Cloudflare Pages, project `pharmaceutical-audio-label`. Auto-deploys on `main` push.
- **Repo:** `github.com/edengrill/pharmaceutical-audio-label`. Local working tree at `~/code/pharmaceutical-audio-label/`.
- **Build:** none. The HTML files in this repo are served directly.
- **Branch:** `main` (note: the worldwide site uses `master` — different branches per repo).

## File map
- `index.html` — homepage. Currently two nav links: pharmaceutical audio (label) + trespasser (event).
- `audio.html` — the label / catalog landing page.
- `albums.html`, `eps.html`, `singles.html`, `mixes.html` — catalog views.
- `trespasser.html` — single event page for the Trespasser event series.
- `trespasser_assets/` — image and asset directory for the trespasser page.

## Core rules
- **Inherit the shared design language** (imported above). Black on white, lowercase, Helvetica, 0.78rem default, generous padding, no decoration.
- **No build step** — edit HTML directly, push, Cloudflare deploys.
- **No external dependencies** — no JS frameworks, no CSS frameworks, no analytics, no fonts. Inline `<style>` blocks only.
- **Don't introduce features the worldwide site has** (scrapers, AI, admin UI, build pipelines). This is a quiet static site by design.

## Context: the 2026-04-28 split
This repo was split off from the worldwide directory on 2026-04-28. The worldwide events directory now lives at `~/code/worldwwwide/` (separate repo: `github.com/edengrill/worldwwwide`). The two products are fully independent — separate domains, separate Cloudflare projects, separate codebases — but share the same design language via the import above.

## Deploys
Push to `main` → Cloudflare auto-deploys → live at `pharmaceutical.audio` ~30 seconds later. There's no staging environment; commits to main go to production.

## Open / planned
- The site is intentionally minimal. New pages added on demand as the catalog grows.
- No automation planned. If something starts to feel automate-able, that's probably the wrong instinct for this site.
