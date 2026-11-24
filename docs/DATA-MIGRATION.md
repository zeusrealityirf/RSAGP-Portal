# Private migration from nine RSAGP workbooks to D1

**Uploaded source:** `RSAGP Sheets-20261123T131251Z-1-001.zip` (offline Excel export). It contains names, Discord identifiers, job applications, citizenship attempts, correspondence and audit logs. **DO NOT upload the ZIP or SQL into GitHub or into the public `site/` folder.**

The converter checks each workbook's sheet names and **exact header order** against `docs/database-schema.json`, keeps values in the original column order, and prepares SQL for the D1 `records` table. Timestamps are converted to ISO-8601; long Discord IDs are preserved as text. Each original record is preserved as one JSON array in D1; the Worker returns the same DTO structures expected by the original UI.

## Snapshot summary (no personal data)

| Tab | Records |
|---|---:|
| members | 4 |
| appointments | 3 |
| proposals | 2 |
| meetings | 1 |
| meetingAttendees | 5 |
| press | 2 |
| letters | 2 |
| signatures | 1 |
| documentSignoffs | 4 |
| citizenshipQuestions | 50 |
| citizenshipAttempts | 2 |
| careerPositions | 6 |
| jobApplications | 2 |
| audit | 66 |
| **Total** | **150** |

Other expected tabs have no rows in this snapshot. The `accessRoles` and `accessUsers` tabs are absent, not corrupted. They will be empty in D1; built-in role definitions continue to work. **Custom grants and personal overrides not present in the export cannot be recovered or inferred.**

## Re-create a private SQL export yourself

From repository root, with Python and `artifact_tool` installed:

```bash
python scripts/workbooks_to_d1.py "/PRIVATE/PATH/RSAGP Sheets-20261123T131251Z-1-001.zip" \
  --output "/PRIVATE/PATH/rsagp-d1-private-import.sql"
```

The script **refuses to write under the repository root** and prints only counts. The SQL contains every source row, including sensitive data. Store it somewhere private and delete unnecessary copies after successful import and backups.

## Import into Cloudflare

1. Back up the existing live Google Sheets and export a fresh snapshot if they have changed since the ZIP date.
2. Create a **new empty** D1 database, configure its ID in `worker/wrangler.toml` and run all migrations (`npx wrangler d1 migrations apply DB --remote`).
3. Import the private SQL from your trusted computer with `npx wrangler d1 execute DB --remote --file="/PRIVATE/PATH/rsagp-d1-private-import.sql"`.
4. Compare per-bucket counts with the table above and test the portal without exposing applicants' answers/audit data.
5. Reconcile records created after the export date before cutting over. **This tool is a one-time import, not a live synchronization.**

## File-migration limitation

The `signatures` and `documentSignoffs` worksheets store **Google Drive file identifiers**, not PNG/JPG bytes. The converter imports those metadata rows for audit fidelity, but **it cannot retrieve the images from those identifiers**. Old images are not automatically copied to R2. All active signatories should upload new signatures through the new portal; any legacy sign-off that does not match the new representation or lacks an image must be re-signed. Do not make a historic signature publicly accessible to work around this.

## Data checking, continuity and rollback

Compare record counts, statuses, applicant ownership, per-person grants and linked meeting IDs before and after import. Keep the old Sheets snapshot read-only as a backup. The importer inserts each row once and **does not delete or overwrite** records if rerun against a populated D1 database. Roll back by switching `site/config.js` back to the old Worker URL only if your legacy Apps Script backend is still live; never discard new D1 submissions or write into the old Sheets without a manual reconciliation plan.
