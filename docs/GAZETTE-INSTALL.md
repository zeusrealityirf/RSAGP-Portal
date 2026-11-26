# RSAGP — Institutional Redesign + Government Gazette

## What is included

This repository includes the full institutional website redesign for Cabinet, Government Careers and Citizenship, plus the latest **reference-matched three-page Government Gazette** (cover, contents, notice). It retains the Cloudflare Worker, D1 schema, R2 signatures, Discord authentication, Roblox connection fixes, letter templates and export functionality.

The Gazette template uses RSAGP-specific reference numbers rather than a real Government Printing Works issue number or barcode. A supplied reference sample was used for page structure and typography.

## Safe install on your existing GitHub repository

1. Create a local backup of the current repository, especially `site/config.js` and `worker/wrangler.toml`.
2. Extract the ZIP **outside** the cloned GitHub repository.
3. Copy the new project files over the existing files, including the hidden `.github` workflow folder; preserve your repository's `.git` folder.
4. Double-check `site/config.js` points to `https://rsagp-api.zeusreality-irf.workers.dev` and `worker/wrangler.toml` still points to the correct D1 database and private R2 bucket.
5. Do not add private SQL imports, Excel workbooks, Discord client secrets, `.dev.vars` or `.env` files to GitHub.
6. Commit and **Push origin** in GitHub Desktop. GitHub Actions deploys the `site/` folder.
7. In Terminal, open the newly updated `worker/` folder and run `npx wrangler deploy`. This separate step updates the Gazette document generation on Cloudflare.
8. Refresh your GitHub Pages website, create a new **Government Gazette notice**, and export a fresh HTML/PDF. Previously generated files do not change retroactively.

## Gazette workflow

In Cabinet → Documents & Signatures → New letter, choose **Government Gazette notice (appointments / official notices)**, enter the issuing department, appointee/office, subject and body, save, issue and sign using your existing permissions. Then select **Download HTML**, open the HTML and use the Save PDF export.

The new Gazette includes a cover, contents and notice layout based on the reference Gazette's structural arrangement. Test actual output in your browser after deployment. Verify the notice content, signatures and references before circulation.

## Tests

Run `node --test tests/*.test.mjs` from the repository root where Node.js is available. These are source and Worker unit tests; they do not replace live Cloudflare authentication and portal acceptance testing.
