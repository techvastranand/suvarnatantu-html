import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import relay from './relay-core.js';

function signatureFor(rawBody, secret, timestamp) {
  return crypto.createHmac('sha256', secret).update(rawBody).update(String(timestamp)).digest('hex');
}

test('accepts a valid Ghost HMAC signature', () => {
  const rawBody = Buffer.from('{"post":{"current":{"slug":"test-post"}}}');
  const secret = 'test-secret';
  const timestamp = 1000000;
  const signature = signatureFor(rawBody, secret, timestamp);
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: `sha256=${signature}, t=1000000`, secret, now: 1000000 }), true);
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: `sha256=${signature}, t=${timestamp}`, secret, now: timestamp }), true);
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: `sha256=${signature},   t=${timestamp}`, secret, now: timestamp }), true);
});

test('rejects changed payloads, timestamps, secrets and malformed signatures', () => {
  const rawBody = Buffer.from('{"post":{}}');
  const timestamp = 1000000;
  const signature = signatureFor(rawBody, 'test-secret', timestamp);
  assert.equal(relay.isValidGhostSignature({ rawBody: Buffer.from('{"post":{"changed":true}}'), signatureHeader: `sha256=${signature}, t=${timestamp}`, secret: 'test-secret', now: timestamp }), false);
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: `sha256=${'0'.repeat(64)}, t=${timestamp}`, secret: 'test-secret', now: timestamp }), false);
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: `sha256=${signature}, t=${timestamp + 1}`, secret: 'test-secret', now: timestamp + 1 }), false);
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: `sha256=${signature}, t=${timestamp}`, secret: 'wrong-secret', now: timestamp }), false);
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: `sha256=${signature}, t=1`, secret: 'test-secret', now: 1000000 }), false);
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: undefined, secret: 'test-secret', now: timestamp }), false);
  assert.equal(relay.isValidGhostSignature({ rawBody, signatureHeader: `sha256=${signature}`, secret: 'test-secret', now: timestamp }), false);
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
