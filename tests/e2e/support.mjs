// Shared Playwright fixtures: a network guard that never lets a real form submission out,
// Engage API mocks for local runs, and per-page diagnostics (console, failed requests, CSP).
import { test as base, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export { expect };
export const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
export const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4102';
const baseHost = new URL(BASE_URL).hostname;
// Live = anything that is not this machine. Live runs are read-only: no mocks, no form submits.
export const IS_LIVE = !['127.0.0.1', 'localhost'].includes(baseHost);
export const ENGAGE = 'https://api-engage.vastranand.com';
export const INTAKE_URL = `${ENGAGE}/v1/public/suvarnatantu-enquiries`;

// ── Page inventory (from the repo; the same files Firebase serves) ──────────────────
const hosting = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8')).hosting;
const redirectRules = (hosting.redirects || []).map(r => new RegExp(r.regex));
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (['.git', 'node_modules', 'tests', 'scripts', 'test-results', 'playwright-report', '.github'].includes(entry.name)) return [];
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : (entry.name.endsWith('.html') ? [path] : []);
});
export const cleanUrlFor = file => {
  const rel = relative(root, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  return `/${rel.replace(/\/index\.html$/, '').replace(/\.html$/, '')}/`;
};
const allUrls = walk(root).map(cleanUrlFor).sort();
export const isRedirected = url => redirectRules.some(re => re.test(url));
// Pages a visitor can reach with a 200 (redirect stubs and the 404 template are tested separately).
export const PAGES = allUrls.filter(url => !isRedirected(url) && url !== '/404/');
export const REDIRECTED = allUrls.filter(isRedirected);

// ── Mock data for the Engage public APIs (local runs only) ─────────────────────────
const envelope = data => JSON.stringify({ message: 'ok', data });
export const MOCK_POST = {
  title: 'A practical guide to specifying metallic yarn',
  slug: 'practical-metallic-yarn-guide',
  excerpt: 'A practical technical guide for comparing yarn construction, twist, denier and application requirements.',
  body_html: '<h2 id="selection">Start with the application</h2><p>Metallic and zari yarn specifications should be reviewed against the intended textile process.</p><script>window.__bad=true</script><p onclick="window.__bad=true">Request a technical reference.</p>',
  featured_media: { url: `${BASE_URL}/assets/images/blog/gold-metallic-yarn-texture.jpg`, alt_text: 'Gold metallic yarn', width: 1200, height: 750, content_type: 'image/jpeg' },
  featured_image_alt: 'Gold metallic yarn prepared for textile production',
  author_name: 'Suvarnatantu Technical Team',
  primary_category: { name: 'Technical Knowledge', slug: 'technical-knowledge' },
  tags: [{ name: 'Metallic Yarn', slug: 'metallic-yarn' }],
  published_at: '2026-10-01T08:00:00Z', updated_at: '2026-10-02T09:00:00Z',
  seo_title: 'Metallic yarn specification guide', seo_description: 'Review practical factors for specifying metallic yarn.',
  canonical_url: '', og_title: '', og_description: '', og_media: null,
};
export const MOCK_FAQ = {
  site: 'suvarnatantu',
  categories: [
    { id: 1, name: 'Samples', description: 'Sampling and evaluation.', questions: [
      { id: 11, question: 'Can I request a production sample?', answer_html: '<p>Yes. Use the sample request form.</p>', popular: true },
      { id: 12, question: 'How long does sample dispatch take?', answer_html: '<p>Dispatch is confirmed after review.</p>' },
    ] },
    { id: 2, name: 'Technical', description: '', questions: [
      { id: 21, question: 'What is denier in metallic yarn?', answer_html: '<p>Denier describes linear mass density.</p>' },
    ] },
  ],
};
const POLICY_HANDLES = ['refund-policy', 'shipping-policy', 'contact-information', 'legal-notice', 'sample-policy', 'payment-terms', 'privacy-policy', 'terms-of-service'];
export const MOCK_POLICIES = { site: 'suvarnatantu', policies: POLICY_HANDLES.map(handle => ({ handle, title: handle.replace(/-/g, ' '), updated_at: '2026-10-01T00:00:00Z' })) };

const json = (route, status, body) => route.fulfill({
  status, contentType: 'application/json; charset=utf-8', body,
  headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Accept' },
});

/** Default Engage GET mocks. `overrides` lets a test swap a response: { blogs, faqs, policies } -> (route) => ... */
export async function mockEngage(page, overrides = {}) {
  await page.route(`${ENGAGE}/**`, async route => {
    const request = route.request();
    if (request.method() !== 'GET') return route.fallback(); // the guard (or a test's intake mock) decides
    const { pathname, searchParams } = new URL(request.url());
    let m;
    if (pathname === '/v1/suvarnatantu/blogs') {
      if (overrides.blogs) return overrides.blogs(route);
      return json(route, 200, envelope({ page: Number(searchParams.get('page') || 1), limit: 20, records_total: 1, records_filtered: 1, data: [MOCK_POST], content_version: 'e2e-v1' }));
    }
    if ((m = /^\/v1\/suvarnatantu\/blogs\/([^/]+)$/.exec(pathname))) {
      return m[1] === MOCK_POST.slug ? json(route, 200, envelope(MOCK_POST)) : json(route, 404, JSON.stringify({ message: 'Not found', data: {} }));
    }
    if (pathname === '/v1/public/site-help/suvarnatantu/faqs') return overrides.faqs ? overrides.faqs(route) : json(route, 200, envelope(MOCK_FAQ));
    if (pathname === '/v1/public/site-help/suvarnatantu/policies') return overrides.policies ? overrides.policies(route) : json(route, 200, envelope(MOCK_POLICIES));
    if ((m = /^\/v1\/public\/site-help\/suvarnatantu\/policies\/([^/]+)$/.exec(pathname))) {
      if (!POLICY_HANDLES.includes(m[1])) return json(route, 404, JSON.stringify({ message: 'Policy not found.', data: {} }));
      return json(route, 200, envelope({ handle: m[1], title: `Mock ${m[1]}`, updated_at: '2026-10-01T00:00:00Z', body_html: `<h2>Overview</h2><p>Mock body for ${m[1]}.</p>` }));
    }
    return json(route, 404, JSON.stringify({ message: 'Not mocked', data: {} }));
  });
}

/** Mock the enquiry intake POST. Returns the captured request payloads. */
export async function mockIntake(page, { status = 200, body } = {}) {
  const captured = [];
  await page.route(INTAKE_URL, async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return json(route, 204, '');
    if (request.method() !== 'POST') return route.fallback();
    captured.push(JSON.parse(request.postData() || '{}'));
    const prefix = { business: 'STB', quote: 'STQ', sample: 'STS' }[captured.at(-1).enquiry_type] || 'STB';
    return json(route, status, JSON.stringify(body ?? { message: 'Accepted', data: { accepted: true, reference: `${prefix}-000123` } }));
  });
  return captured;
}

// ── Fixtures ───────────────────────────────────────────────────────────────────────
export const test = base.extend({
  diagnostics: [async ({ page }, use) => {
    const d = { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [], blocked: [], csp: [] };
    // Guard: registered first, so it is the fallback for every request. Nothing that writes
    // (non-GET) may leave for a host that is not the site itself, mocked or not, live or local.
    await page.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      const sameSite = url.hostname === baseHost;
      const method = request.method();
      if (!['GET', 'HEAD'].includes(method) && (!sameSite || IS_LIVE)) {
        d.blocked.push(`${method} ${request.url()}`);
        return route.abort('blockedbyclient');
      }
      if (sameSite || IS_LIVE || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
      d.blocked.push(`${method} ${request.url()} (unmocked external GET in a local run)`);
      return route.abort('blockedbyclient');
    });
    if (!IS_LIVE) await mockEngage(page);
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', e => window.__cspViolations.push({ directive: e.effectiveDirective || e.violatedDirective, blockedURI: e.blockedURI, sourceFile: e.sourceFile, line: e.lineNumber, disposition: e.disposition }));
    });
    page.on('console', msg => {
      if (msg.type() !== 'error' && msg.type() !== 'warning') return;
      const text = msg.text();
      if (/\[Report Only\]/.test(text)) { d.csp.push(text); return; }
      if (msg.type() === 'error') d.consoleErrors.push(text);
    });
    page.on('pageerror', error => d.pageErrors.push(String(error)));
    page.on('requestfailed', request => {
      const failure = request.failure()?.errorText || 'failed';
      if (failure.includes('ERR_ABORTED') && request.resourceType() === 'document') return; // navigation replaced
      d.failedRequests.push(`${request.method()} ${request.url()} ${failure}`);
    });
    page.on('response', response => {
      const url = response.url();
      if (response.status() >= 400 && response.request().resourceType() !== 'document') d.badResponses.push(`${response.status()} ${url}`);
    });
    await use(d);
  }, { auto: true }],
});

/** Wait for the page's own scripts and the API-backed regions to settle. */
export async function settle(page) {
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15_000 }).catch(() => {});
}
