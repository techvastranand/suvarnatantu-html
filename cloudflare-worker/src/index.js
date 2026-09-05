import { verifyGhostSignature } from './signature.js';

const githubDispatchUrl = 'https://api.github.com/repos/techvastranand/suvarnatantu-html/dispatches';

export async function handleRequest(request, env, fetchImpl = fetch) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { Allow: 'POST', 'Content-Type': 'application/json' } });
  if (!env.GHOST_WEBHOOK_SECRET || !env.GITHUB_DISPATCH_TOKEN) return new Response(JSON.stringify({ error: 'server_not_configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const rawBody = await request.arrayBuffer();
  const valid = await verifyGhostSignature({ rawBody, signatureHeader: request.headers.get('X-Ghost-Signature'), secret: env.GHOST_WEBHOOK_SECRET });
  if (!valid) return new Response(JSON.stringify({ error: 'invalid_signature' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  let githubResponse;
  try {
    githubResponse = await fetchImpl(githubDispatchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ event_type: 'ghost_publish' })
    });
  } catch {
    return new Response(JSON.stringify({ error: 'github_dispatch_failed' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  if (!githubResponse.ok) return new Response(JSON.stringify({ error: 'github_dispatch_failed' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ accepted: true }), { status: 202, headers: { 'Content-Type': 'application/json' } });
}

export default { fetch: handleRequest };
