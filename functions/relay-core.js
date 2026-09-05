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
  if (!match) return false;
  if (match[2] && Math.abs(now - Number(match[2])) > maxAgeMs) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqual(expected, match[1].toLowerCase());
}

function safeEventMetadata(body) {
  const post = body && typeof body === 'object' ? body.post : null;
  return {
    event: typeof body?.event === 'string' ? body.event : 'unknown',
    slug: typeof post?.current?.slug === 'string' ? post.current.slug : (typeof post?.slug === 'string' ? post.slug : 'unknown')
  };
}

module.exports = { isValidGhostSignature, safeEventMetadata };
