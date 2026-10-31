// Every public page: 200, no console errors, no failed requests, no horizontal scroll at 375px,
// plus the CSP report-only violations each page would raise (recorded, never failing).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, PAGES, REDIRECTED, IS_LIVE, settle, root } from './support.mjs';

const cspFindings = [];

for (const url of PAGES) {
  test(`page ${url} loads cleanly`, async ({ page, diagnostics }, testInfo) => {
    const response = await page.goto(url);
    expect(response?.status(), `${url} status`).toBe(200);
    expect(new URL(page.url()).pathname, 'no redirect for a canonical page').toBe(new URL(url, 'http://x').pathname);
    await settle(page);
    // Let lazily-started scripts (shell, image warm-up) finish.
    await page.waitForTimeout(300);
    expect(diagnostics.pageErrors, 'uncaught page errors').toEqual([]);
    expect(diagnostics.consoleErrors, 'console errors').toEqual([]);
    expect(diagnostics.failedRequests, 'failed requests').toEqual([]);
    expect(diagnostics.badResponses, 'subresources with 4xx/5xx').toEqual([]);
    expect(diagnostics.blocked, 'requests stopped by the guard').toEqual([]);
    if (testInfo.project.name === 'mobile-375') {
      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement || document.documentElement;
        const wide = [...document.querySelectorAll('body *')].filter(node => {
          const r = node.getBoundingClientRect();
          return r.width > 0 && r.right > el.clientWidth + 1 && getComputedStyle(node).position !== 'fixed';
        }).slice(0, 5).map(node => `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`);
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, wide };
      });
      expect(overflow.scrollWidth, `horizontal scroll at 375px (widest: ${overflow.wide.join(', ')})`).toBeLessThanOrEqual(overflow.clientWidth);
    }
    const violations = await page.evaluate(() => window.__cspViolations || []);
    if (violations.length || diagnostics.csp.length) {
      cspFindings.push({ project: testInfo.project.name, url, violations, console: diagnostics.csp });
      testInfo.annotations.push({ type: 'csp-report-only', description: JSON.stringify(violations) });
    }
  });
}

for (const url of REDIRECTED) {
  test(`legacy ${url} redirects to a live page`, async ({ request }) => {
    const first = await request.get(url, { maxRedirects: 0 });
    expect(first.status()).toBe(301);
    const final = await request.get(url);
    expect(final.status()).toBe(200);
  });
}

test('unknown URL serves the 404 page with a 404 status', async ({ page, request }) => {
  const missing = `/definitely-not-a-page-${Date.now()}/`;
  const api = await request.get(missing);
  expect(api.status()).toBe(404);
  const response = await page.goto(missing);
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('.site-nav')).toBeVisible();
});

test.afterAll(async ({}, testInfo) => {
  const dir = join(root, 'test-results');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `csp-report-only-${IS_LIVE ? 'live' : 'local'}-${testInfo.project.name}-w${testInfo.workerIndex}.json`), JSON.stringify(cspFindings, null, 2));
});
