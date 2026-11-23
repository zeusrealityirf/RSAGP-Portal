# RSAGP — Original Portal, GitHub Pages Edition

**This repository was generated from the provided `RSAGP_Custom_Roles_Permissions_Manager_Upgrade (1).zip`.** It preserves the uploaded source, original layout, Cabinet workspace, Careers desk, Citizenship desk, signatures/documents, Discord sign-in, spreadsheet data model and custom roles/permissions manager.

The site's **HTML/CSS/JavaScript and branding images are served from GitHub Pages** instead of being rendered by Google Apps Script. The existing Google Apps Script project remains the **backend**: it verifies Discord logins, reads/writes the current Google Sheets and enforces permissions. A very small Cloudflare Worker forwards browser requests to the Apps Script `doPost` endpoint to work around CORS.

> **Not a zero-backend conversion.** GitHub Pages only serves static files; Apps Script is still needed for existing data and workflows. This may reduce initial page-delivery latency, but backend requests still incur Apps Script/Sheets latency. No data has been copied, cleared, or migrated.
>
> **Status:** Files converted; local source/transport tests available. Live Discord OAuth, Worker, permissions, document generation and Google Sheets flows have **not** been tested against your account and require setup and verification.

## Deployment

Read **[docs/DEPLOY.md](docs/DEPLOY.md)** for the full procedure. The order is:

1. Back up your live Apps Script project and nine Google Sheets workbooks.
2. Update the Apps Script `Code.gs` and add `GitHubPagesBridge.gs` from `apps-script/RSAGP_Project/`; redeploy as a new Web App version.
3. Create a GitHub repository, push this repository, and enable GitHub Pages via GitHub Actions.
4. Set the Apps Script property `GITHUB_PAGES_URL` to your actual Pages site URL.
5. Deploy the Worker in `worker/`, configure its allowed origin and the Apps Script Web App URL.
6. Put the resulting Worker URL in `site/config.js` and push again.
7. Test public listings, Discord login, per-role access and authorized writes (using test records).

### Repository map

```
site/                         True original pages, statically rendered
  index.html                  Cabinet Secretariat (Index.html)
  careers/index.html          CareersPortal.html
  citizenship/index.html      CitizenPortal.html
  assets/                     PNGs extracted from the uploaded source
  js/bridge.js                Worker transport + OAuth session fragment receiver
  config.js                   PUBLIC config: Worker URL only (no secrets)
apps-script/RSAGP_Project/     Original .gs/.html project, including two backend patches
  Code.gs                     Preserves original logic, adds OAuth return hand-off
  GitHubPagesBridge.gs        New explicit server API allowlist / doPost
worker/                       CORS proxy; no database access outside Apps Script
scripts/build-static.py       Rebuild static HTML from the original templates
.github/workflows/pages.yml   Deploys site/ to GitHub Pages on main
```

### Development

```bash
python3 scripts/build-static.py
python3 -m http.server 8080 --directory site
```

Pages show a backend-configuration message until you connect the Worker. The Careers page fetches vacancies from the live backend; it does not claim that the built-in default vacancies are presently open. To inspect the UI in its pre-login state without a backend, open the local server URL.

### Regenerating after a change

Edit the original templates in `apps-script/RSAGP_Project/` (not generated `site/` HTML), then run:

```bash
python3 scripts/build-static.py
```

Commit both the source and the rebuilt site so deployment stays in sync.

## Existing Google Sheets backups (newly supplied)

The supplied nine-workbook Excel export was compared against the portal's `Code.gs`: **17 existing tabs match the expected schema**. The Cabinet workbook is missing `accessRoles` and `accessUsers`, the two tabs needed to edit custom role and per-user permissions. **No workbook data was embedded in the website or this repository.**

See [docs/WORKBOOKS.md](docs/WORKBOOKS.md) for the workbook-to-Script-Property mapping, the permissions setup path and safe restoration guidance. To check any future backup locally:

```bash
python3 scripts/audit-sheets.py "/path/to/RSAGP Sheets.zip"
```

This inspection changes no Google Sheets and does not connect to your live database.

## Security and privacy

The initial ZIP contains application code, **not** live Google Sheets or your Script Properties. Before publishing a *public* repository, personally review the uploaded source for confidential materials and unpublished policies. Never commit `DISCORD_CLIENT_SECRET`, `GOV_SHEET_ID` when sensitive, signed document contents, private exports, API tokens, user sessions, `.dev.vars`, or downloaded application data. The original branding represents a **Roblox roleplay government**, not an official Republic of South Africa service.

- Supreme Administrator access still comes **only** from the original `SUPREME_ADMIN_DISCORD_IDS` Script Property.
- Rights and role overrides are enforced in the original Apps Script functions. The new HTTP adapter only exposes an explicit approved action list; it does not add grants.
- The Worker allows browser CORS only for the specified Pages origin. CORS **is not authentication**; your existing unpredictable session tokens and backend permission checks are the security boundary.
- The Discord OAuth redirect URI remains your **Apps Script `/exec` URL**, and credentials remain only in Script Properties.
- Never deploy backend secrets to a static GitHub Pages site. Review application handling, rate limits, access logs, privacy, terms and legal obligations before using real applicant records.

## Notes

- No Supabase migration is needed for this conversion; all existing workbooks can remain where they are.
- App Script HTML service uses a sandbox. After signing in, users click **Continue to portal** in the success screen (the sign-in token is included in the URL fragment and removed by the static app).
- This project is different from the earlier generic starter: it uses **your uploaded portal source** and keeps its exact feature areas and visual design.
