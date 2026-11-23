# RSAGP: Publish on GitHub Pages while retaining Google Sheets

**Before making changes:** Back up the Apps Script project, its Script Properties and all connected workbooks. There are no migrations in this guide, and no need to recreate the nine spreadsheets. Take extra care if your existing live project differs from the uploaded ZIP: apply the **two small backend additions** to your live project rather than replacing newer code with the ZIP.

## 1 — Choose a GitHub repository

1. Create a new repository on GitHub (private repository if available; GitHub Pages deployment visibility depends on your plan and repository settings).
2. Upload or push the contents of this repository. Example:

   ```bash
   git init
   git add .
   git commit -m "RSAGP: adapt original portal for GitHub Pages"
   git branch -M main
   git remote add origin https://github.com/YOURUSERNAME/YOURREPO.git
   git push -u origin main
   ```
3. Under **Settings → Pages**, choose **GitHub Actions** as the build/deploy source.
4. The provided `.github/workflows/pages.yml` publishes the `site/` directory automatically.
5. Record the actual Pages URL, e.g. `https://YOURUSERNAME.github.io/YOURREPO/` (or the URL of your custom domain). If you later change the repo or custom domain, update all matching settings below.

## 2 — Update the current Apps Script backend

1. Open the existing Google Apps Script project that already owns RSAGP and is connected to your Google Sheets. **Do not run `setupPortal`, the split-migration functions or create new workbooks merely for this conversion.**
2. In your live `Code.gs`, add the GitHub Pages OAuth handoff found inside `doGet` in `apps-script/RSAGP_Project/Code.gs`. If your live code exactly matches the uploaded version you may replace its complete `Code.gs`; otherwise merge just the new `pagesUrl` block, keeping all your current logic.
3. Add a new Apps Script *Script* file named `GitHubPagesBridge` (not an HTML file), and paste `apps-script/RSAGP_Project/GitHubPagesBridge.gs`. This adds `doPost` with a strict function allowlist and preserves all existing permission checks.
4. Keep all remaining `.gs` files, existing OAuth configuration, `WEB_APP_URL` and workbook IDs unchanged. In **Project Settings → Script Properties**, add:

   ```text
   GITHUB_PAGES_URL = https://YOURUSERNAME.github.io/YOURREPO/
   ```

   Set exactly the URL where GitHub Pages serves the top-level Cabinet page. Use HTTPS and include the repo path, if any.
5. Under **Deploy → Manage deployments**, edit the existing Web App deployment and select a **New version**, then redeploy. Confirm the Web App still has suitable public access for Discord login and server requests, and that **Execute as** matches the existing deployment (normally the script owner). Copy the resulting `/exec` Web App URL.
6. **Discord Developer Portal:** Leave the registered OAuth redirect pointing to your **Apps Script `/exec`** URL, not to GitHub Pages or Cloudflare Worker. If the Apps Script deployment URL changes, update the registered Discord redirect and the `WEB_APP_URL` Script Property accordingly.

> Why this works: Discord calls back to Apps Script, which completes its verified OAuth exchange and stores the existing short-lived session in CacheService. Apps Script displays a one-click continuation link to the GitHub Pages view using the session token as a URL fragment. The site saves the session into `sessionStorage` and strips that fragment from browser history.

## 3 — Deploy the Cloudflare Worker

The browser cannot call Apps Script `google.script.run` from a GitHub-hosted page. Cross-origin `fetch` calls to Apps Script's ContentService aren't reliably CORS-enabled, so the Worker forwards them server-side.

1. Create/sign into a Cloudflare account. Install Node.js on your computer if needed.
2. In the `worker/` folder, open `wrangler.toml`. Replace the placeholder `SITE_ORIGIN` with the actual **origin** of your GitHub Pages URL; for example:

   ```toml
   SITE_ORIGIN = "https://YOURUSERNAME.github.io"
   ```

   **Do not** include `/YOURREPO/` here; browser Origin headers contain only the scheme and hostname (plus a port if any). For a custom domain, use that origin instead. Remove `LOCAL_DEV_ORIGIN` after testing if not needed.
3. Run:

   ```bash
   cd worker
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put GAS_WEB_APP_URL
   ```

   When prompted for the secret, enter the existing Apps Script Web App URL of the form `https://script.google.com/macros/s/.../exec`. It is deployment configuration, not a Discord credential. Make sure it matches the latest published Apps Script version.
4. Note the URL Wrangler prints after deployment (normally `https://rsagp-api.ACCOUNT.workers.dev`). Keep the Worker URL for the next step. Cloudflare Workers may have account/usage limits, which you should review for production.

The Worker responds only to `POST /api` and browser preflight requests from the allowed site origin, forwards approved JSON to Apps Script, and returns JSON. It never creates a new user/session itself. Users should never be asked to type their Discord token into the site.

## 4 — Configure the GitHub Pages front end

Edit `site/config.js`:

```js
window.RSAGP_CONFIG = {
  apiUrl: 'https://rsagp-api.ACCOUNT.workers.dev'
};
```

This is a **public URL**, so it is safe to publish; do not put Google credentials, API secrets or Discord credentials in this file. Save and push to `main`. Wait for the Actions deployment to finish and open the Pages URL.

## 5 — Verify before letting users use it

- **Public Careers:** load `/careers/` when signed out. Confirm the vacancy count equals the live Careers workbook (including any closed positions).
- **Discord login:** sign in via the Careers or Cabinet desk. Discord should return to the Apps Script success page; click **Continue to portal** to return to the correct GitHub Pages section.
- **Permissions:** use a non-admin test account and confirm restricted sections and server-side writes are denied; use a designated Supreme Admin to review custom role/person overrides.
- **Data:** create a harmless test record and verify it appears in the existing Google Sheets, then delete or close it through the appropriate authorized workflow. Test meeting, press, careers and citizenship workflows.
- **Exports:** open a generated HTML document, print to PDF and save PNG as before. Test image/signature flows with a small test image. Check the existing browser download restrictions.
- **Failure modes:** remove `apiUrl` temporarily in a test copy and verify that the page clearly refuses to submit rather than fabricating records.

If you receive **Origin not allowed**, check `SITE_ORIGIN`; if the browser says **API is not configured**, update `site/config.js`; if you receive **Apps Script did not return JSON**, check the Web App access, `/exec` URL and that you deployed the new version with `GitHubPagesBridge.gs`. If Discord returns to the old Apps Script UI instead of the success link, check the `GITHUB_PAGES_URL` Script Property and redeployment. A session is short-lived; signing in again is expected after it expires.

## Important limitations

- **Front-end load can be faster**, but Apps Script and spreadsheet operations may still be the slow part. This conversion is not a performance benchmark and no speedup is guaranteed.
- GitHub Pages is a static host. It cannot by itself securely operate a nine-workbook database, validate Discord OAuth secrets or enforce individual permission overrides.
- An Apps Script or Cloudflare outage will make live services unavailable even if the static page still loads.
- No live database, Discord OAuth, Google Sheets, production Cloudflare Worker or GitHub repository was created or accessed in preparing this artifact.
- This is a faithful source-based adapter, not an audited production release. Conduct access-control, privacy, scalability and security testing before using it for real applications.
