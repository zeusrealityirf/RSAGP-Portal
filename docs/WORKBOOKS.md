# RSAGP: Google Sheets database and workbook exports

This portal is a **GitHub Pages front end with an Apps Script / Google Sheets backend**. The `.xlsx` exports supplied on 23 November 2026 are offline snapshots, not live connections. They must **not** be placed in `site/` or committed to GitHub, even if the repository is private: the snapshots contain identities, applications, citizenship, documents, and audit history.

## Results for the supplied ZIP

The file `RSAGP Sheets-20261123T131251Z-1-001.zip` contained nine `.xlsx` workbooks. Their 17 existing tabs have the **correct names and header ordering** for the backend in `apps-script/RSAGP_Project/Code.gs`.

Two tabs expected in the **Cabinet Directory & Staff** workbook were absent:

- `accessRoles` — custom role definitions and permission sets
- `accessUsers` — per-person role assignments and allow/deny overrides

The supplied snapshots **do not contain custom role/individual override records**. The original code can fall back to built-in role defaults for reads, but custom permission edits require those tabs. Never infer or invent existing roles/overrides from other records, and do not overwrite a live version of those tabs if one already exists.

To audit a new offline backup locally, run:

```bash
python3 scripts/audit-sheets.py "/path/to/RSAGP Sheets.zip"
```

This checks tab names and all column headers; it **does not display or upload any personal record values**. The expected column schema is in `docs/database-schema.json`, derived from the provided `Code.gs`.

## Mapping the nine workbooks

| Workbook (file export) | Apps Script property | Tabs |
|---|---|---|
| Cabinet Directory & Staff | `GOV_SHEET_ID` | `members`, `appointments`, `accessRoles`, `accessUsers` |
| Policy & Legislation | `GOV_MULTI_POLICY_ID` | `proposals`, `actDrafts` |
| Cabinet Meetings & Attendance | `GOV_MULTI_MEETING_ID` | `meetings`, `meetingAttendees`, `decisions` |
| Executive Actions | `GOV_MULTI_ACTIONS_ID` | `actions` |
| Press Office | `GOV_MULTI_PRESS_ID` | `press` |
| Documents & Signatures | `GOV_MULTI_DOCUMENTS_ID` | `letters`, `signatures`, `documentSignoffs` |
| Citizenship Services | `GOV_MULTI_CITIZEN_ID` | `citizenshipQuestions`, `citizenshipAttempts` |
| Government Careers | `GOV_MULTI_CAREERS_ID` | `careerPositions`, `jobApplications` |
| Security & Audit Trail | `GOV_MULTI_AUDIT_ID` | `audit` |

The configuration also uses `GOV_MULTI_ACTIVE=true` to route records to all nine workbooks. **Do not flip this setting in an existing installation unless the nine correct live workbooks have been backed up, verified and are accessible to the Apps Script owner.** Wrong IDs may appear as missing data to users and may route future writes to the wrong files.

## If the existing Google Sheets are already live

1. **Keep the existing live sheets.** There is no benefit to uploading the `.xlsx` snapshots over them. Offline files may already be out of date.
2. In the existing Apps Script project, review the stored Script Properties (do not publish the property values) and check the nine-workbook setup. The IDs belong in Script Properties **only**, not in the GitHub Pages `site/config.js`.
3. From the Apps Script editor, use `verifyRSAGPMultiDatabaseSplit()` for an active split setup. It compares tab names and headers. If the actual live Cabinet workbook lacks only `accessRoles` and `accessUsers`, run `setupAccessControl()` from the editor as its owner to create them and seed built-in defaults, **after backing up**. Do not use it to replace existing custom grants.
4. Confirm custom roles and per-person permissions with a designated Supreme Administrator via the portal.

If roles and user overrides already exist in the live sheets, keep those instead of reconstructing them from the supplied export.

## If restoring the nine `.xlsx` exports into a *new* installation

1. Keep the ZIP and extracted workbooks private. Upload each separately to **Google Drive**, convert each to a **native Google Sheets spreadsheet**, and verify the number of tabs, column headings and row counts. Do not combine all nine into one workbook.
2. Check that the Apps Script owner has read/write access to all nine new Sheets. Copy each new spreadsheet's **ID from its Google Sheets URL**; exporting to `.xlsx` does not preserve the original live spreadsheet ID.
3. In the *new/test* Apps Script project's Script Properties, set `GOV_SHEET_ID` and the eight `GOV_MULTI_..._ID` values according to the table. Only after verifying their destinations, enable `GOV_MULTI_ACTIVE=true` in that new environment.
4. Run `setupAccessControl()` from the Apps Script editor as owner. This creates the two missing permissions tabs in the core workbook and seeds built-in roles; it **cannot restore missing custom permissions**.
5. Run `verifyRSAGPMultiDatabaseSplit()`, inspect the returned tab counts, and test the portal with separate applicant and reviewer accounts before going live.

For safety, don't run `advanceRSAGPMultiDatabaseMigration()` on these imported workbooks; that migration helper is designed to copy an existing single live database into newly created staging workbooks, **not** to restore exports. Keep the existing `SUPREME_ADMIN_DISCORD_IDS` configured in Script Properties, never in the public site.

## Data-quality notes

- Discord ID fields examined in the supplied exports are text, as required by the backend, which avoids floating-point rounding for long Discord identifiers.
- Keep long identifiers formatted as **plain text** after import (especially Discord IDs). Do not automatically convert them to numbers.
- The files contain nonempty application and audit records. Never expose them from browser JavaScript, the GitHub repository or the Cloudflare Worker. Only the Apps Script permission-checked API should return records to authorized users.
- This is an offline schema inspection, **not** a live data sync or end-to-end validation.
