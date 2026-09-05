const encoder = new TextEncoder();

export function parseGhostSignature(header) {
  if (typeof header !== 'string') return null;
  const match = /^sha256=([a-f0-9]{64}),\s*t=(\d+)$/i.exec(header.trim());
  return match ? { signature: match[1].toLowerCase(), timestamp: match[2] } : null;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function signedBytes(rawBody, timestamp) {
  const suffix = encoder.encode(timestamp);
  const bytes = new Uint8Array(rawBody.byteLength + suffix.byteLength);
  bytes.set(new Uint8Array(rawBody), 0);
  bytes.set(suffix, rawBody.byteLength);
  return bytes;
}

export async function verifyGhostSignature({ rawBody, signatureHeader, secret, now = Date.now(), maxAgeMs = 300000 }) {
  const parsed = parseGhostSignature(signatureHeader);
  if (!parsed || !secret || Math.abs(now - Number(parsed.timestamp)) > maxAgeMs) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, hexToBytes(parsed.signature), signedBytes(rawBody, parsed.timestamp));
}
