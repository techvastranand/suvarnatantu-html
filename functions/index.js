'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const { isValidGhostSignature, safeEventMetadata } = require('./relay-core');

const githubDispatchToken = defineSecret('GITHUB_DISPATCH_TOKEN');
const ghostWebhookSecret = defineSecret('GHOST_WEBHOOK_SECRET');
const requestWindows = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60000;

function isRateLimited(ip, now = Date.now()) {
  const startedAt = requestWindows.get(ip);
  if (!startedAt || now - startedAt.startedAt >= RATE_WINDOW_MS) {
    requestWindows.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  startedAt.count += 1;
  return startedAt.count > RATE_LIMIT;
}

exports.ghostWebhook = onRequest({
  region: 'asia-south1',
  secrets: [githubDispatchToken, ghostWebhookSecret],
  cors: false,
  invoker: 'public'
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).set('Allow', 'POST').json({ error: 'method_not_allowed' });

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'rate_limited' });

  const secret = ghostWebhookSecret.value();
  if (!isValidGhostSignature({ rawBody: req.rawBody, signatureHeader: req.get('x-ghost-signature'), secret })) {
    logger.warn('Rejected Ghost webhook', { ip });
    return res.status(401).json({ error: 'invalid_signature' });
  }

  const metadata = safeEventMetadata(req.body);
  try {
    const response = await fetch('https://api.github.com/repos/techvastranand/suvarnatantu-html/dispatches', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubDispatchToken.value()}`,
        'User-Agent': 'suvarnatantu-ghost-webhook-relay',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ event_type: 'ghost_publish' })
    });
    logger.info('Ghost webhook dispatch attempted', { ...metadata, githubStatus: response.status });
    if (!response.ok) return res.status(502).json({ error: 'github_dispatch_failed' });
    return res.status(202).json({ accepted: true });
  } catch (error) {
    logger.error('Ghost webhook dispatch failed', { ...metadata, error: error instanceof Error ? error.message : 'unknown_error' });
    return res.status(502).json({ error: 'github_dispatch_failed' });
  }
});

module.exports._test = { isRateLimited };
