# RSAGP — Custom Roles & Permissions Manager

## What this upgrade adds

- **Permission Manager** inside **Supreme Administration**.
- Role editor: create new roles and edit built-in roles, with permissions grouped by application area.
- User editor: assign one or several roles to a **permanent Discord user ID** and optionally **Allow** or **Deny** individual permissions.
- Separate access for viewing sections and making changes. For example, a Recruitment Officer can review job applications without accessing Cabinet appointments.
- Enforcement for **server-side Apps Script methods**, not just hidden UI buttons. All changes are recorded in the audit sheet.
- Works with the existing **nine-workbook** architecture. The two new permission tabs live in the **Cabinet Directory & Staff / core workbook**, and the audit entries continue going to the existing Audit Trail workbook.

## Installing into your existing Apps Script project

1. **Back up** the Google Apps Script project and linked database(s).
2. Open your existing RSAGP Apps Script editor.
3. Replace the complete contents of these existing files with the supplied versions:
   - `Code.gs`
   - `Index.html`
   - `Careers.gs`
   - `ActDrafts.gs`
   - `Stationery.gs`
   - `DocumentSignoffs.gs`
4. In Apps Script, click **+ → Script** and create a new Script file called **`PermissionManager`**. Paste the supplied `PermissionManager.gs` into it. Do **not** create an HTML file for this module.
5. Leave other files, your deployment URL and your Script Properties unchanged. No new Discord OAuth redirects are needed.
6. Save all files. In the function dropdown, choose **`setupAccessControl`**, click **Run**, and complete the Apps Script authorization prompts. Run it **once**; it is safe to repeat if necessary. It creates and seeds `accessRoles` and `accessUsers` sheets in your existing core database. **Do not delete the original data or recreate the other databases.** If it reports that the database isn't configured, run your existing `setupPortal` first according to your standard installation guide.
7. Go to **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**.
8. Sign in as a Discord account listed in the Script Property `SUPREME_ADMIN_DISCORD_IDS`, then visit **Supreme Administration → Permissions Manager**.
9. Create a role and assign it to a test Discord ID. Open an incognito window and confirm the test user can perform only the intended actions.

## Example: recruitment team

1. Open **Permissions Manager → New role**.
2. Role name: `Recruitment Officer`.
3. Select **View job applications** and **Review job applications**. Do not select **Manage recruitment vacancies** unless the officer should edit position titles, questions and open/closed status.
4. Save.
5. Select **Assign user**, paste the recruiter's permanent Discord user ID, and check `Recruitment Officer`.
6. Save. The user can access the Government Portal's Job Applications page but does not receive Cabinet editing or Supreme Administration permissions.

## Per-person overrides

- **Inherit:** follow all active roles assigned to the person.
- **Allow:** add the selected permission for this Discord ID only.
- **Deny:** withhold the selected permission even if another assigned role grants it. A denied permission cannot be restored by adding another ordinary role.
- **Disable:** suspends all permissions assigned through that individual-access record. Cabinet appointments continue to have their own built-in roles unless their access is explicitly denied or the Cabinet appointment is deactivated.

## Protected permissions and operational limits

- **Supreme Administrator access** cannot be assigned from the portal and is available only to Discord IDs in `SUPREME_ADMIN_DISCORD_IDS` (Script Properties).
- **Script Properties, OAuth credentials and database migration/administration** are not exposed as grantable permissions.
- Signing a document still requires its normal workflow conditions (for example, an issued letter or approved press release), even if the user has signing permission; only the actual author can sign their own issued letter.
- Applicant acceptance does not automatically appoint a minister. Cabinet appointments remain separate.
- An assigned permission does not override other validation, e.g. a user may need to own a draft to edit it.
- Permission data is cached briefly (15 seconds on read paths) and invalidated when edited. If a user is already logged in, refresh or sign in again to update the visible navigation.
- If your project still uses one database, this works without splitting anything. If you already use nine, the new sheets go in core without another migration.

## Troubleshooting

**No Permissions Manager menu?** Ensure your Discord account is in `SUPREME_ADMIN_DISCORD_IDS`, run `setupAccessControl`, deploy a new version and sign back in.

**Missing `accessRoles` or `accessUsers`?** Run `setupAccessControl` in the Apps Script editor. Check the **core** workbook (not the recruitment or audit workbook).

**Role saved but user has no menu?** Verify the permanent Discord ID, the role's Active checkbox, the person's Active checkbox, and that View workspace/view-specific rights aren't set to Deny.

**Need to revoke access immediately?** Edit the person's permissions and press Save. All successful portal writes bump the global data revision. For a protected Supreme Administrator, remove the Discord ID from Script Properties.

**Need to roll back?** Redeploy the previous Apps Script version. The new role/assignment tabs are additive and do not alter existing Cabinet, Careers or Citizenship records. Do not delete the new tabs unless you are sure the previous version doesn't use them.

## Included files

The ZIP contains the **complete RSAGP project**, including files not changed by this upgrade. For incremental installation use only the six replacement files plus the new `PermissionManager.gs` module listed above. You can keep your existing `appsscript.json` if its scopes are unchanged.

*Local syntax, permission-engine and responsive-interface tests passed. End-to-end tests with live Discord OAuth and the connected Google Sheets must be performed after deployment.*
