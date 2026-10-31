// Internal links and assets resolve; external links are checked report-only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, PAGES, IS_LIVE, root } from './support.mjs';

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => test.skip(test.info().project.name !== 'desktop-chrome', 'link checks run once (desktop project)'));

const SITE = 'https://suvarnatantu.com';
const attr = /\b(?:href|src|srcset|content|poster|data-src)=("([^"]*)"|'([^']*)')/g;

function collect(html, pageUrl, internal, external) {
  for (const m of html.matchAll(attr)) {
    const raw = (m[2] ?? m[3] ?? '').replace(/&amp;/g, '&');
    const values = m[0].startsWith('srcset') ? raw.split(',').map(s => s.trim().split(/\s+/)[0]) : [raw];
    for (const value of values) {
      if (!value || /^(#|mailto:|tel:|javascript:|data:|blob:|about:)/i.test(value) || value.includes('${')) continue;
      if (m[0].startsWith('content') && !/^(https?:)?\/\/|^\//.test(value)) continue;
      let url;
      try { url = new URL(value, `${SITE}${pageUrl}`); } catch { continue; }
      if (!/^https?:$/.test(url.protocol)) continue;
      if (url.hostname === 'suvarnatantu.com') { url.hash = ''; internal.add(url.pathname + url.search); }
      else if (!/schema\.org$|api-engage\.vastranand\.com$/.test(url.hostname)) external.add(url.href);
    }
  }
}

test('internal links and assets resolve', async ({ request }) => {
  test.setTimeout(IS_LIVE ? 900_000 : 300_000);
  const internal = new Set(PAGES);
  const external = new Set();
  for (const pageUrl of PAGES) {
    const res = await request.get(pageUrl);
    expect(res.status(), pageUrl).toBe(200);
    collect(await res.text(), pageUrl, internal, external);
  }
  // Links the shared shell injects at runtime (header/footer).
  for (const file of ['assets/js/site-shell.js', 'assets/js/site-shell-links.js', 'assets/js/b2b-flow.js']) collect(readFileSync(join(root, file), 'utf8'), '/', internal, external);
  // CSS url(...) assets.
  for (const css of [...internal].filter(u => /\.css(\?|$)/.test(u))) {
    const res = await request.get(css);
    for (const m of (await res.text()).matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
      if (!/^(data:|#)/.test(m[2])) internal.add(new URL(m[2], `${SITE}${css}`).pathname);
    }
  }
  const broken = [];
  for (const url of internal) {
    const res = await request.get(url, { failOnStatusCode: false });
    if (res.status() >= 400) broken.push(`${res.status()} ${url}`);
    if (IS_LIVE) await new Promise(r => setTimeout(r, 50));
  }
  test.info().annotations.push({ type: 'internal-urls-checked', description: String(internal.size) });
  expect(broken, 'broken internal links/assets').toEqual([]);
  test.info().attach('external-links.json', { body: JSON.stringify([...external], null, 2), contentType: 'application/json' });
  globalThis.__externalLinks = [...external];
});

test('external links (report-only)', async ({ request }) => {
  test.setTimeout(180_000);
  const links = globalThis.__externalLinks || [];
  const report = [];
  for (const href of links) {
    let status;
    try { status = (await request.get(href, { timeout: 15_000, failOnStatusCode: false, maxRedirects: 5 })).status(); }
    catch (error) { status = `error: ${String(error.message).split('\n')[0]}`; }
    report.push({ href, status });
    await new Promise(r => setTimeout(r, 200));
  }
  const bad = report.filter(r => typeof r.status !== 'number' || r.status >= 400);
  test.info().annotations.push({ type: 'external-links', description: `${report.length} checked, ${bad.length} not OK: ${JSON.stringify(bad)}` });
  test.info().attach('external-links-status.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
});
