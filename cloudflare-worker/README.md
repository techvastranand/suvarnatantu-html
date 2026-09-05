# Suvarnatantu Ghost webhook relay

This Cloudflare Worker is the production-ready, free-plan relay for Ghost publishing events. It validates Ghost's HMAC signature over the exact raw request bytes plus timestamp, then sends GitHub `repository_dispatch` event `ghost_publish`. It uses no Firebase Functions, Cloud Run, database, Durable Object, or paid Cloudflare feature.

## Deploy on Cloudflare Workers Free

1. Create or sign in to a free Cloudflare account.
2. From `cloudflare-worker/`, authenticate: `npx wrangler login`.
3. Deploy: `npx wrangler deploy`.
4. Store secrets interactively; do not paste them into source files:

   ```text
   npx wrangler secret put GITHUB_DISPATCH_TOKEN
   npx wrangler secret put GHOST_WEBHOOK_SECRET
   ```

5. Re-deploy after adding secrets: `npx wrangler deploy`.

Wrangler will print the free `workers.dev` URL. Use that exact HTTPS URL as the Ghost webhook target; no Suvarnatantu DNS change is needed.

## Ghost Admin configuration

In `https://suvarnatantu.ghost.io/ghost/`, go to **Settings → Advanced → Integrations** and create or use **Suvarnatantu Static Blog**. Add four webhooks to the Worker URL, all with the same secret stored as `GHOST_WEBHOOK_SECRET`:

- `post.published`
- `post.published.edited`
- `post.unpublished`
- `post.deleted`

The static generator safely prunes only its own previously generated article directories, so unpublish/delete events correctly remove those article pages on the next deployment.

## Manual recovery

GitHub → Actions → **Deploy to Firebase Hosting on merge** → **Run workflow** → `force_rebuild=true`.
