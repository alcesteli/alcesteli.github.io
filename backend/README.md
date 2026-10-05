# Journal migration: Supabase → Cloudflare

Status: production is switched to Cloudflare Workers + D1. The 4 published
articles and 1 approved comment were imported and verified field by field. The
original Supabase project remains intact as a rollback copy.

## Architecture

- Existing GitHub Pages site → public Worker `/api/posts` and `/api/comments`.
- Same admin UI served by Worker at `https://alceste-journal.alcesteli-journal.workers.dev/admin.html`.
- Cloudflare Access email OTP protects `/admin.html`, `/api/admin/*`, and `/`.
  Public `/api/posts`, `/api/comments`, and `/js/*` must NOT be behind Access.
- The Worker separately verifies Access JWT signature, issuer, audience, expiry
  and the exact administrator email. Missing configuration fails closed.
- D1 stores posts, comments and short-lived rate limit hashes. Drafts and pending
  comments are never returned publicly. Visitors cannot choose moderation state
  or the author badge. Admin mutations require the same Origin to prevent CSRF.
- Old `alcesteli.com/admin.html` redirects to the Worker admin page.
- Only the generated `backend/public/` allowlist is uploaded as static assets.
  Never upload `.migration/`, environment files or database exports as assets.

## Provisioning (free plans only)

1. From repository root: `npm ci --prefix backend`.
2. `node backend/node_modules/wrangler/bin/wrangler.js login`.
3. `node backend/node_modules/wrangler/bin/wrangler.js d1 create journal`.
4. Put the returned database ID in `backend/wrangler.jsonc`.
5. If the existing domain is already managed by Cloudflare, attach the Worker
   custom domain `alcesteli-journal.workers.dev`. Do not alter the main site's GitHub Pages
   records. If it is not managed there, first resolve domain onboarding or choose
   a Worker hostname and update `JOURNAL_API_URL` accordingly; do not silently
   change nameservers.
6. Create a Cloudflare Access self-hosted application for the admin paths above.
   Enable One-time PIN and an Allow policy for ONLY the owner's exact email.
   Use the same application's AUD for all protected paths. Do not use an
   unrestricted "everyone" policy or protect the public API with the admin app.
7. Fill `ACCESS_TEAM_DOMAIN` (hostname only), `ACCESS_AUD`, `ADMIN_EMAIL` in
   `backend/wrangler.jsonc`. These are configuration, not bearer credentials.
8. `npm run db:remote --prefix backend`.
9. `npm run deploy --prefix backend`.

If using a custom domain, add the following to Wrangler after confirming DNS:

```json
"routes": [{ "pattern": "admin.alcesteli.com", "custom_domain": true }]
```

Disable `workers_dev` when using the custom domain to reduce alternate entry
points (the Worker still requires JWT validation on every admin request).

## Complete data migration

Keep the original Supabase project and database intact throughout verification.
The public Supabase key cannot export drafts/pending comments: use the project
secret/service-role key locally, or export both full tables from the SQL editor.
Do not send keys through chat or commit them.

1. Briefly freeze old writes: pause publishing and remove public INSERT grants
   for comments in Supabase, recording the original grants/policies for rollback.
   The old frontend should display a temporary maintenance notice during this
   window. Do not keep both systems writable during cutover.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the local shell without
   including secrets in shell history. Run `node scripts/export-supabase.mjs`.
   The ignored `.migration/supabase.json` contains ALL posts and comments, not
   just public rows. It is written with mode 0600 and will not overwrite a backup.
3. `node scripts/convert-migration.mjs` creates `.migration/import.sql`.
   The converter preserves IDs, dates, Unicode, draft/moderation flags, and reply
   relationships. It validates duplicates/cycles/missing parents and orders
   parents before children. Comments for deleted posts are retained intentionally.
4. Import into the EMPTY migrated D1 database:
   `node backend/node_modules/wrangler/bin/wrangler.js d1 execute journal --remote --config backend/wrangler.jsonc --file .migration/import.sql`.
5. Export D1 back to a local private file and compare every post/comment field
   against the source export (SQLite boolean 0/1 corresponds to false/true).
   Check total counts and draft/pending/reply counts separately. Keep both exports
   offline; they must not enter Git or GitHub Pages.
6. Verify the live Worker: public articles and approved comments, protected admin
   login, save draft, publish/unpublish, comment submission, moderation, reply,
   parent deletion, and logout. Only use disposable test records for destructive
   checks. Verify the public site can make CORS requests from its actual domain.
7. Confirm `JOURNAL_API_URL` matches the deployed hostname, rebuild admin assets,
   deploy Worker, then publish frontend changes to GitHub Pages. Keep the original
   Supabase data read-only until the live site is accepted.
8. After acceptance, remove/close the obsolete Supabase project to end inactivity
   notices. This is irreversible and should be performed separately with approval.

Rollback: before accepting writes on D1, restore the previous frontend commit and
original Supabase grants. After D1 has accepted new writes, export/reconcile those
writes first; simply pointing back would lose new articles/comments.

## Local verification

`npm test --prefix backend` runs real SQLite-backed route tests covering signed
JWT verification, unauthorized access, CSRF, moderation, rate limiting, article
publishing, duplicate slugs, reply deletion and migration integrity.

`npm run build --prefix backend` builds only the admin asset allowlist.

`node backend/node_modules/wrangler/bin/wrangler.js deploy --dry-run --config backend/wrangler.jsonc`
validates the Worker bundle without publishing.

`npm run db:local --prefix backend` validates the D1 migrations locally. Local
development deliberately has no administrator authentication bypass.

Current limits and operational details:
https://developers.cloudflare.com/d1/platform/pricing/
https://developers.cloudflare.com/d1/platform/limits/
https://developers.cloudflare.com/workers/platform/limits/
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
