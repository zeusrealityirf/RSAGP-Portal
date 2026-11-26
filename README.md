# RSAGP Portal — GitHub Pages + Cloudflare (no Apps Script)

This is a migration of the user's **original RSAGP Roblox roleplay government portal**. Its original Cabinet, Careers and Citizenship HTML interfaces and branding are preserved in `site/`. Server-side requests now go to **Cloudflare Workers + D1**, with private uploaded signature files in **Cloudflare R2**. There are **no runtime calls to Google Apps Script or Google Sheets**.

The original `.gs` sources are retained in `apps-script/RSAGP_Project/` only as a **historical reference and HTML-template source**. Do **not** deploy them. `scripts/build-static.py` can still regenerate the original pages from the archived source without using Apps Script as a service.

> **Status:** This package is a source update for the already deployed Cloudflare Worker. Automated tests pass locally; the restored designs have not been deployed or verified with the live database. The user must redeploy the Worker and confirm production behavior. Do not cut over until the checklist in `docs/DEPLOY.md` passes.

## Architecture

```text
GitHub Pages: https://zeusrealityirf.github.io/RSAGP-Portal/
       |
       |  POST {action, args} to Worker /api
       v
Cloudflare Worker (Discord OAuth + login sessions + server-side permissions)
       |
       +-- Cloudflare D1 (19 record collections + OAuth/session tables)
       +-- Private Cloudflare R2 (uploaded signatures + signed snapshots)
```

## Files

- `site/` — original public interfaces, CSS, JavaScript and brand images
- `site/js/bridge.js` — frontend API transport; no Apps Script dependency
- `site/config.js` — PUBLIC Worker URL configuration only, no credentials
- `worker/src/` — rewritten backend (51 original API operations), Discord OAuth, D1 storage, access checks, document exports, R2 private signatures
- `worker/migrations/` — D1 schema and workflow-integrity trigger (safe to commit)
- `scripts/workbooks_to_d1.py` — **local-only** offline converter for nine Excel exports; outputs **PRIVATE** SQL outside the repository
- `docs/DEPLOY.md` — setup and deployment checklist
- `docs/DATA-MIGRATION.md` — workbook import and data validation
- `tests/cloudflare-worker.test.mjs` — local integration tests (Node 22+)
- `.github/workflows/pages.yml` — deploys `site/` on pushes to main

## Your first three steps

1. Read **[docs/DEPLOY.md](docs/DEPLOY.md)** and create the D1 database and private R2 bucket on Cloudflare.
2. Run the D1 migrations and import the separately supplied **PRIVATE** SQL export. Never put that SQL in a Git repository.
3. Configure Discord credentials in Worker secrets, deploy the Worker, and set its URL in `site/config.js`. Commit/push the updated website files to `zeusrealityirf/RSAGP-Portal`.

## Original document design restored

The `worker/src/original-templates.js` module includes the original supplied typography, letterhead art, document layouts and citizenship card template, with roleplay disclaimers intact. `worker/src/documents.js` uses these designs while continuing to check permissions and load signatures from private R2. See `docs/RESTORED-DOCUMENTS.md` for the two-file update.

## Local checks

```bash
cd worker
node --test ../tests/cloudflare-worker.test.mjs
# after npm install
npx wrangler d1 migrations apply DB --local
npx wrangler dev
```

The Worker can start locally after binding a local D1 database, but Discord login requires a matching development callback redirect. Tests use synthetic accounts and do not contact Discord.

## Data privacy & limitations

- Supplied workbook contents were **not included** in this GitHub repository or in `site/`.
- A separate, private import SQL has been produced from the 23 November 2026 nine-workbook ZIP (150 records). This is a **snapshot** and may not contain newer live records.
- The snapshot lacks the original `accessRoles` and `accessUsers` sheets. Built-in role defaults are available in code, but missing custom assignments are **not recreated or guessed**.
- The spreadsheet snapshot contains signature and sign-off **file references**, not their binary images. Previously stored Google Drive signature images must be re-uploaded to R2; old sign-offs may require re-signing.
- Document export layouts now reuse the original source designs for ministerial and presidential letters, press releases, agendas, attendance registers, proposed Bills, and roleplay citizenship cards. The backend remains Cloudflare; verify each format against production data and check print/PDF/PNG outputs on your browser.
- Rate limiting, ongoing backup scheduling, security monitoring and production Discord OAuth are recommended before public launch; local checks do not establish production readiness.
- This is a **Roblox roleplay government**, not a real public government service. Do not present roleplay documents as official South African government credentials.

Never commit any of: `DISCORD_CLIENT_SECRET`, `SUPREME_ADMIN_DISCORD_IDS`, Discord sessions, `.dev.vars`, your private SQL import, or the XLSX workbooks. All permissions are checked in the Worker against current D1 records on each protected request. Browser-side rights controls are presentational only.

## Roblox connection update

See [`docs/ROBLOX-CONNECTION.md`](docs/ROBLOX-CONNECTION.md) for the Worker-side
Roblox profile/thumbnail reliability fix, testing instructions, and limitations.


## Institutional redesign + Gazette update

This edition includes the complete redesigned Cabinet, Careers, and Citizenship HTML as well as the reference-matched Gazette cover, contents page, appointment notices and HTML→PDF export. See [docs/GAZETTE-INSTALL.md](docs/GAZETTE-INSTALL.md) for safe deployment instructions.
