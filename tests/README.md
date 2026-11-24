# Checks

Run `node --test tests/cloudflare-worker.test.mjs` from the repository root with Node.js 22+ (uses the experimental `node:sqlite` API for a local in-memory D1 stand-in).

This checks authorization, roles, applicant workflows, vacancy close-on-acceptance, document export scaffolding and sign-out against **synthetic test accounts**. It does **not** test live Discord OAuth, R2 storage, or deployed D1.

`node --test tests/bridge-smoke.mjs` checks frontend transport/OAuth fragment handling.

`python tests/check-source.py` checks that original portal HTML was converted without runtime Apps Script calls. `docs/ORIGINAL_TEST_RESULTS.md` is historical testing documentation from the earlier GitHub Pages adaptation.
