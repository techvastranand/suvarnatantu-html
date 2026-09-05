import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { handleRequest } from '../src/index.js';
import { verifyGhostSignature } from '../src/signature.js';

const encoder = new TextEncoder();
const secret = 'test-webhook-secret';
const token = 'test-github-token';
const body = '{"event":"post.published","post":{"current":{"slug":"test-post"}}}';
const timestamp = Date.now();
const env = { GHOST_WEBHOOK_SECRET: secret, GITHUB_DISPATCH_TOKEN: token };

function signatureFor(value = body, time = timestamp, signingSecret = secret) {
  return crypto.createHmac('sha256', signingSecret).update(value).update(String(time)).digest('hex');
}

function signedRequest({ value = body, time = timestamp, signature = signatureFor(value, time), method = 'POST' } = {}) {
  return new Request('https://worker.example/', { method, headers: { 'X-Ghost-Signature': `sha256=${signature}, t=${time}` }, body: method === 'POST' ? value : undefined });
}

test('accepts a valid raw-body-plus-timestamp Ghost signature, including spaces after comma', async () => {
  const header = `sha256=${signatureFor()},   t=${timestamp}`;
  assert.equal(await verifyGhostSignature({ rawBody: encoder.encode(body).buffer, signatureHeader: header, secret, now: timestamp }), true);
});

test('rejects invalid, wrong-secret, modified-body, modified-timestamp, expired, missing and malformed signatures', async () => {
  const rawBody = encoder.encode(body).buffer;
  assert.equal(await verifyGhostSignature({ rawBody, signatureHeader: `sha256=${'0'.repeat(64)}, t=${timestamp}`, secret, now: timestamp }), false);
  assert.equal(await verifyGhostSignature({ rawBody, signatureHeader: `sha256=${signatureFor()}, t=${timestamp}`, secret: 'wrong-secret', now: timestamp }), false);
  assert.equal(await verifyGhostSignature({ rawBody: encoder.encode(`${body} `).buffer, signatureHeader: `sha256=${signatureFor()}, t=${timestamp}`, secret, now: timestamp }), false);
  assert.equal(await verifyGhostSignature({ rawBody, signatureHeader: `sha256=${signatureFor()}, t=${timestamp + 1}`, secret, now: timestamp + 1 }), false);
  assert.equal(await verifyGhostSignature({ rawBody, signatureHeader: `sha256=${signatureFor()}, t=1`, secret, now: timestamp }), false);
  assert.equal(await verifyGhostSignature({ rawBody, signatureHeader: undefined, secret, now: timestamp }), false);
  assert.equal(await verifyGhostSignature({ rawBody, signatureHeader: `sha256=${signatureFor()}`, secret, now: timestamp }), false);
  assert.equal(await verifyGhostSignature({ rawBody, signatureHeader: 'invalid', secret, now: timestamp }), false);
});

test('rejects non-POST methods', async () => {
  const response = await handleRequest(new Request('https://worker.example/', { method: 'GET' }), env);
  assert.equal(response.status, 405);
});

test('dispatches valid webhooks to GitHub and returns 202', async () => {
  let received;
  const response = await handleRequest(signedRequest(), env, async (url, options) => {
    received = { url, options };
    return new Response(null, { status: 204 });
  });
  assert.equal(response.status, 202);
  assert.equal(received.url, 'https://api.github.com/repos/techvastranand/suvarnatantu-html/dispatches');
  assert.equal(received.options.headers.Authorization, `Bearer ${token}`);
  assert.deepEqual(JSON.parse(received.options.body), { event_type: 'ghost_publish' });
});

test('returns 401 for unsigned or invalid webhooks and 502 for GitHub dispatch failures', async () => {
  const unsigned = await handleRequest(new Request('https://worker.example/', { method: 'POST', body }), env);
  assert.equal(unsigned.status, 401);
  const wrong = await handleRequest(signedRequest({ signature: signatureFor(body, timestamp, 'wrong-secret') }), env);
  assert.equal(wrong.status, 401);
  const failed = await handleRequest(signedRequest(), env, async () => new Response(null, { status: 401 }));
  assert.equal(failed.status, 502);
});
