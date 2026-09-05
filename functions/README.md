# Ghost publishing webhook relay

This Firebase Functions v2 endpoint dispatches a `ghost_publish` event to GitHub after it validates a Ghost webhook signature. It does not expose a GitHub token to the static site.

## Deployment prerequisites

An administrator with Firebase/Google Cloud and GitHub access must set these Secret Manager values (never commit them):

```text
firebase functions:secrets:set GHOST_WEBHOOK_SECRET --project suvarnatantu-vastranand
firebase functions:secrets:set GITHUB_DISPATCH_TOKEN --project suvarnatantu-vastranand
firebase deploy --only functions:ghostWebhook --project suvarnatantu-vastranand
```

Create `GITHUB_DISPATCH_TOKEN` as a fine-grained GitHub token restricted to `techvastranand/suvarnatantu-html`, with the minimum permission that permits repository dispatches. Set a long random value for `GHOST_WEBHOOK_SECRET`.

After deployment, the endpoint is:

```text
https://asia-south1-suvarnatantu-vastranand.cloudfunctions.net/ghostWebhook
```

## Ghost Admin setup

In Ghost Admin, go to **Settings → Advanced → Integrations → Add custom integration**. Add webhooks for `post.published` and the published-post edit event available in the Ghost UI, both targeting the endpoint above. Set the same webhook secret as `GHOST_WEBHOOK_SECRET`; Ghost sends it as `X-Ghost-Signature`.

## Manual recovery

If webhook delivery fails, use **GitHub → Actions → Deploy to Firebase Hosting on merge → Run workflow**, with `force_rebuild=true`.
