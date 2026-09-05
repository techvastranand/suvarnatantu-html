'use strict';

const crypto = require('node:crypto');

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isValidGhostSignature({ rawBody, signatureHeader, secret, now = Date.now(), maxAgeMs = 300000 }) {
  if (!rawBody || !signatureHeader || !secret) return false;
  const match = /^sha256=([a-f0-9]{64})(?:,\s*t=(\d+))?$/i.exec(signatureHeader.trim());
  if (!match || !match[2]) return false;
  if (Math.abs(now - Number(match[2])) > maxAgeMs) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).update(match[2]).digest('hex');
  return timingSafeEqual(expected, match[1].toLowerCase());
}

function safeEventMetadata(body) {
  const post = body && typeof body === 'object' ? body.post : null;
  return {
    event: typeof body?.event === 'string' ? body.event : 'unknown',
    slug: typeof post?.current?.slug === 'string' ? post.current.slug : (typeof post?.slug === 'string' ? post.slug : 'unknown')
  };
}

function createPayloadDeduplicator(ttlMs = 300000) {
  const seen = new Map();
  return (rawBody, now = Date.now()) => {
    const hash = crypto.createHash('sha256').update(rawBody).digest('hex');
    for (const [key, timestamp] of seen) if (now - timestamp >= ttlMs) seen.delete(key);
    if (seen.has(hash)) return true;
    seen.set(hash, now);
    return false;
  };
}

module.exports = { createPayloadDeduplicator, isValidGhostSignature, safeEventMetadata };
