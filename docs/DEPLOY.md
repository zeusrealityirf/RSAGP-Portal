# Deploy RSAGP without Google Apps Script or Google Sheets

This deploys the original public UI on GitHub Pages and the **new backend** on Cloudflare. The Pages address can stay `https://zeusrealityirf.github.io/RSAGP-Portal/`.

**You need:** access to your GitHub repo, a Cloudflare account with Workers/D1/R2 enabled, and the Discord Developer Portal application owner account. Keep your existing Google Sheets/Apps Script deployment running until successful verification and backup. The uploaded Excel exports are offline snapshots, not a live sync.

## 1 — Create Cloudflare resources

Install Node.js and, in the **repository's `worker/` directory**, run:

```bash
npm install
npx wrangler login
npx wrangler d1 create rsagp-db
npx wrangler r2 bucket create rsagp-private-files
```

Copy the D1 `database_id` (UUID) from Cloudflare's response into `worker/wrangler.toml` under `[[d1_databases]]`. Keep the binding name `DB` and R2 binding `FILES`. Confirm the names match the resources you created. Make sure the Worker `SITE_ORIGIN` and `SITE_URL` are:

```toml
[vars]
SITE_ORIGIN = "https://zeusrealityirf.github.io"
SITE_URL = "https://zeusrealityirf.github.io/RSAGP-Portal/"
```

**These two URLs contain no secrets.** `SITE_URL` includes the trailing repository slash; `SITE_ORIGIN` does not include the path.

## 2 — Create D1 tables, then import workbook data privately

```bash
cd worker
npx wrangler d1 migrations apply DB --remote
```

**Before importing**, follow `docs/DATA-MIGRATION.md` and back up the source. A private SQL export for the previously uploaded nine workbooks has been prepared separately. **Do not add it to this repository or upload it to GitHub.** From the local machine that holds that private SQL file:

```bash
npx wrangler d1 execute DB --remote --file="/ABSOLUTE/PRIVATE/PATH/rsagp-d1-private-import.sql"
```

Use the `--remote` flag: the default local database does **not** populate production D1. Import is intentionally not idempotent; repeating it should fail, rather than silently replacing existing production records. Check that the target is empty and back it up first.

To verify record counts without retrieving personal values:

```bash
npx wrangler d1 execute DB --remote --command="SELECT bucket, COUNT(*) AS rows FROM records GROUP BY bucket ORDER BY bucket;"
```

The supplied export contains 150 records across 14 populated tabs; the missing `accessRoles` and `accessUsers` are empty by design.

## 3 — Deploy once to establish the Worker URL, then configure Discord OAuth

From `worker/`, run `npx wrangler deploy` after setting the D1 UUID and running migrations. Cloudflare will give you the final Worker hostname. The initial deployment can run before Discord secrets are configured; login will not work yet.

Open your Discord application in the [Discord Developer Portal](https://discord.com/developers/applications).

Configure the application OAuth2 Redirect URI to:

```
https://rsagp-api.YOUR-CLOUDFLARE-SUBDOMAIN.workers.dev/auth/callback
```

Use the **exact** Worker URL that Cloudflare gives you, including the `/auth/callback` suffix. If you change the Worker hostname/custom domain, update the Discord redirect URI. Never set the redirect URI to GitHub Pages: the Worker must exchange Discord OAuth codes on the server.

In `worker/`, set secrets interactively (the CLI requests each value):

```bash
npx wrangler secret put DISCORD_CLIENT_ID
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler secret put SUPREME_ADMIN_DISCORD_IDS
```

- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` come from your Discord application.
- `SUPREME_ADMIN_DISCORD_IDS` is a comma-separated list of **permanent Discord user IDs** for the portal owner(s). These users alone can change the custom permissions manager; the list cannot be changed from the portal.
- Optional: `npx wrangler secret put PRESIDENT_DISCORD_IDS` for legacy bootstrap President IDs.

**No secrets belong in `site/config.js`, GitHub Actions workflow files or your Git repository.**

## 4 — Verify the Worker after setting secrets

Run `npx wrangler deploy` again after setting secrets if necessary. Cloudflare provides a URL like `https://rsagp-api.YOUR-SUBDOMAIN.workers.dev`. Visit its `/health` endpoint — it should return JSON with `service: RSAGP Worker D1 backend`. This does **not** verify the database, Discord OAuth, or every portal operation; continue the tests below.

## 5 — Connect GitHub Pages to Cloudflare

In the `site/config.js` file in your GitHub repository, set only the **base Worker HTTPS URL**:

```javascript
window.RSAGP_CONFIG = {
  apiUrl: 'https://rsagp-api.YOUR-SUBDOMAIN.workers.dev'
};
```

Do not append `/api` or `/auth`. Do not add any secrets. Commit the change to `main`; the existing `.github/workflows/pages.yml` deploys the entire `site/` directory via GitHub Actions. Check the deployment run has a green tick before opening `https://zeusrealityirf.github.io/RSAGP-Portal/`.

## 6 — Cutover checks (do not skip)

1. **Public Careers** — open positions show from D1 (not from the old spreadsheets); closed positions stay hidden.
2. **Discord login** — test Cabinet, Careers and Citizenship separately. Confirm that the page returns via `#rsagp_session=` and the fragment disappears from the address bar when loaded. Never share that fragment/token with anyone.
3. **Permissions** — a normal applicant must be denied Cabinet pages and application review; an allowed reviewer can review but not edit roles; the configured Supreme Administrator can edit roles and per-user permissions.
4. **Application acceptance** — with test records, accept an application and confirm the corresponding position closes.
5. **Citizenship** — exam loads, scoring completes, review forbids approving your own application, and approved roleplay card exports correctly.
6. **Documents** — upload a fresh PNG/JPG signature to R2, generate HTML, test PNG and Print → Save as PDF, and verify sign-off changes after document edits.
7. **Audit** — inspect authorized audit entries. Check requests in Cloudflare Logs for errors without storing private application responses.
8. **Cross-check data** — see `docs/DATA-MIGRATION.md`; reconcile newer live Sheets changes since the exported snapshot.

Only after successful tests should you retire the old Apps Script deployment. Existing Google Sheets can remain as offline backups. No Apps Script or Google Sheets API is required by this new runtime.

## Production safeguards

- Add Worker rate limits and bot-abuse controls at Cloudflare; current app-level submission limits are a baseline, not complete DoS protection.
- Schedule D1 backups/exports and protect R2 objects. Keep historical application/identity data private and define a retention period.
- Rotate credentials if they ever appeared in a repository, screenshot or client-side JavaScript.
- Consider a separate staging Worker/DB/R2 bucket for acceptance testing so you never alter live records to validate a deployment.
- Users changing their roles are evaluated server-side on every authenticated request; CORS checks do not replace authentication.
