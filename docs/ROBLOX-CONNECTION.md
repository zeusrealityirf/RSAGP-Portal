# RSAGP Roblox connection update

The Cloudflare migration keeps **Discord** as the login mechanism. The Roblox
connection only resolves a public username to a Roblox account ID, displays public
avatars, and records the submitted Roblox account in applications. A public lookup
**does not prove Roblox account ownership**.

## What changed

- `worker/src/roblox.js` now handles all Roblox HTTP requests; no Google Apps Script.
- A username is resolved with the official public `users.roblox.com/v1/usernames/users`
  endpoint, and a temporary upstream failure can fall back to the official
  `users.roblox.com/v1/users/search` endpoint. A **case-insensitive exact username**
  match is still required; similarly named results do not count.
- HTTP 403 and 429 are distinguished from a nonexistent username. We do **not**
  bypass Roblox restrictions or rate limits; only temporary connection / 5xx
  errors invoke the fallback.
- Successful username lookups are cached for 10 minutes in the Worker isolate.
- Up to 50 public avatar images are resolved in **one batch request** instead of
  one network request per staff member, with 15-minute memory caching.
- An avatar service failure does not stop navigation or document generation.
- Thumbnail URLs must be HTTPS on Roblox's `rbxcdn.com` domain.
- Failed requests log their HTTP status or failure type (not account credentials)
  to Cloudflare Worker logs for troubleshooting.

## Install without changing existing database/settings

1. Replace `worker/src/operations.js` and `worker/src/documents.js`, and add
   `worker/src/roblox.js` from the patch.
2. If you also want the latest South African letter PDF fix, replace
   `worker/src/original-templates.js` from the **combined** patch instead.
3. Keep your existing `worker/wrangler.toml` and `site/config.js`. Do **not**
   recreate D1, re-import records, or change Discord secrets.
4. In your local repository's `worker` folder:

   ```sh
   npx wrangler deploy
   ```

5. In GitHub Desktop, commit and push the same source changes to the repository.
   GitHub Pages does not need a fresh front-end build for this backend-only fix.

## Test it

- Sign in with Discord, open a Cabinet avatar setting, and enter a **Roblox account
  username** (not a display name). Saving should resolve the username and avatar.
- Check a Roblox username in Citizenship and submit a test application in Careers.
- Confirm multiple Cabinet profile avatars load and normal documents still export.
- If the Roblox service rejects a request, the message will now say whether it was
  rate-limited (429), refused (403), or temporarily unavailable. Repeated 403s/429s
  can be caused by restrictions outside the RSAGP portal.
- With Wrangler signed in, run `npx wrangler tail rsagp-api` to inspect production
  request errors. Do not share tokens, secrets, or private application data.

## Local automated tests

Run from the repository root:

```sh
node --test tests/roblox-connection.test.mjs tests/cloudflare-worker.test.mjs tests/document-layout.test.mjs
```

These tests mock the Roblox responses. They do **not** prove that the live Roblox
API is reachable from your particular Cloudflare Worker deployment.
