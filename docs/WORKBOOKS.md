# Legacy workbook references

The nine original workbook names, tabs and column headers are recorded in `docs/database-schema.json`. Those workbooks are now **historical source data**, not the portal's runtime database.

For the actual private migration and validation procedure, see **[DATA-MIGRATION.md](DATA-MIGRATION.md)**. For deployment without Apps Script, see **[DEPLOY.md](DEPLOY.md)**. Do not re-enable the old Google Sheets backend after the Cloudflare cutover without separately reconciling new D1 records.
