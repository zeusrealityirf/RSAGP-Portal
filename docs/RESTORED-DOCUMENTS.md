# Restore the original document designs (Cloudflare)

The first Cloudflare migration used a generic document layout. This update restores the **user-supplied RSAGP design** for letters, press releases, Cabinet agendas, meeting attendance, draft Bills, and roleplay citizenship cards. It uses the original art and stylesheet embedded in the old Apps Script source, but does **not** call Google Apps Script or Google Sheets.

## Fast, safe update — only two Worker files

1. Make a backup of the current `RSAGP-Portal` repository on your Mac.
2. Extract `RSAGP-Original-Document-Design-Fix.zip`.
3. Copy the two files from its `worker/src/` folder into your **local GitHub clone** at `RSAGP-Portal/worker/src/`, replacing `documents.js` and adding `original-templates.js`. **Do not replace** `site/config.js`, `worker/wrangler.toml`, or your D1 data.
4. In Terminal, from the repository's `worker` folder, run `npx wrangler deploy`. That deploys the new document renderer using your existing D1 and R2 resources.
5. Use GitHub Desktop to commit the same two Worker changes and **Push origin** so your repo matches the deployed code. GitHub Pages itself does not need any new public HTML files for this server-side fix.
6. Open your portal and **generate a fresh document**. Previously downloaded documents will not change retroactively. Verify letterheads, card design, Bill cover, signatures, and HTML/PNG/PDF outputs.

If you prefer replacing the full repository, use the separately supplied complete ZIP instead, but back up any configuration edits and verify the Worker URL and D1 ID before deploying.

## What remains different

- Legacy Google Drive signature images are not stored in the D1 workbook export. Re-upload signatures to R2 where needed; sign-offs may need to be recorded again.
- A Roblox avatar will only appear on a citizenship card if its thumbnail can be retrieved by the backend; otherwise the original design's **PLAYER AVATAR** placeholder appears.
- The original user-facing documents are for a fictional Roblox roleplay nation; disclaimers are preserved.
- Visual layout is restored from original source, but browser print/PDF/PNG engines can differ; test the outputs you actually distribute.

## Files changed

- `worker/src/documents.js` — document content renderers and R2 signature blocks; keeps the existing API names and permissions.
- `worker/src/original-templates.js` — original embedded art, CSS, Bill cover, citizenship card, and letterhead renderer.
- Optional full package: updated tests and deployment settings.

**Do not import SQL again or recreate the D1 database or R2 bucket.**
