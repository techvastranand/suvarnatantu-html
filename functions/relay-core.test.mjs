import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import relay from './relay-core.js';

test('accepts a valid Ghost HMAC signature', () => {
  const rawBody = Buffer.from('{"post":{"current":{"slug":"test-post"}}}');
  const secret = 'test-secret';
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: `sha256=${signature}, t=1000000`, secret, now: 1000000 }), true);
});

test('rejects changed payloads, stale events and malformed signatures', () => {
  const rawBody = Buffer.from('{"post":{}}');
  const signature = crypto.createHmac('sha256', 'test-secret').update(rawBody).digest('hex');
  assert.equal(relay.isValidGhostSignature({ rawBody: Buffer.from('{"post":{"changed":true}}'), signatureHeader: `sha256=${signature}`, secret: 'test-secret' }), false);
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: `sha256=${signature}, t=1`, secret: 'test-secret', now: 1000000 }), false);
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: 'not-a-signature', secret: 'test-secret' }), false);
});

test('extracts only safe log metadata', () => {
  assert.deepEqual(relay.safeEventMetadata({ event: 'post.published', post: { current: { slug: 'test-post' } } }), { event: 'post.published', slug: 'test-post' });
});

test('suppresses duplicate payloads only inside its time window', () => {
  const duplicate = relay.createPayloadDeduplicator(1000);
  const body = Buffer.from('{"post":{}}');
  assert.equal(duplicate(body, 1000), false);
  assert.equal(duplicate(body, 1500), true);
  assert.equal(duplicate(body, 2001), false);
});
