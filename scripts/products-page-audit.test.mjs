import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const page = readFileSync(join(root, 'products', 'index.html'), 'utf8');

const sections = [
  'class="page-hero"',
  'class="content-section product-finder"',
  'class="content-section alt product-catalogue"',
  'class="content-section metallic-comparison"',
  'class="content-section product-applications"',
  'class="content-section product-finishes"',
  'class="content-section product-zari-guidance"',
  'class="cta-band"'
];

test('Products sections occur once in the intended buyer-journey order', () => {
  let previous = -1;
  for (const marker of sections) {
    const position = page.indexOf(marker);
    assert.ok(position > previous, `${marker} is missing or out of order.`);
    assert.equal(page.split(marker).length - 1, 1, `${marker} should occur once.`);
    previous = position;
  }
  assert.doesNotMatch(page, /B2B buying flow|From requirement to production/);
});

test('Products page has unique IDs and no placeholder links', () => {
  const ids = [...page.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.doesNotMatch(page, /href=["'](?:#|javascript:|\s*["'])/i);
});

test('verified catalogue, comparison, application and colour routes remain present', () => {
  assert.equal((page.match(/data-product-family="/g) || []).length, 6);
  for (const type of ['m-type', 'mx-type', 'st-type', 'mh-type']) {
    assert.match(page, new RegExp(`href="/metallic-yarn/${type}/"`));
  }
  assert.equal((page.match(/class="product-application-card"/g) || []).length, 9);
  assert.equal((page.match(/href="\/applications\/[^"]+\/"/g) || []).length, 9);
  assert.equal((page.match(/class="product-finish-card"/g) || []).length, 6);
  for (const colour of ['gold', 'silver', 'copper', 'rose-gold', 'antique', 'custom']) {
    assert.match(page, new RegExp(`href="/colours/${colour}/"`));
  }
});

test('context-aware Sample and RFQ links survive the CTA hierarchy cleanup', () => {
  assert.equal((page.match(/href="\/samples\/\?family=/g) || []).length, 10);
  assert.equal((page.match(/href="\/samples\/\?application=/g) || []).length, 8);
  assert.equal((page.match(/href="\/samples\/\?colour=/g) || []).length, 6);
  assert.equal((page.match(/href="\/samples\/\?finish=/g) || []).length, 5);
  assert.match(page, /href="\/request-quote\/\?family=colours-finishes"/);
  assert.match(page, /data-product-finder-primary/);
  assert.match(page, /data-product-finder-secondary/);
});

test('Zari Lab guidance routes and the final three-way action remain crawlable', () => {
  for (const anchor of ['build-your-zari', 'technical-lab', 'reference-review', 'troubleshooting-lab', 'colour-finish-lab']) {
    assert.match(page, new RegExp(`href="/zari-lab/#${anchor}"`));
  }
  const final = page.match(/<section class="cta-band">[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(final, /href="\/request-quote\/">Request Quote/);
  assert.match(final, /href="\/samples\/">Request Sample/);
  assert.match(final, /href="\/zari-lab\/#build-your-zari">Open Zari Lab/);
});

test('every internal Products-page link resolves locally, including fragments', () => {
  const hrefs = [...page.matchAll(/<a\b[^>]*\shref="(\/[^"]*)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
  for (const href of hrefs) {
    const url = new URL(href, 'https://suvarnatantu.com');
    const slug = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    const candidates = url.pathname === '/' ? [join(root, 'index.html')] : [join(root, slug, 'index.html'), join(root, `${slug}.html`)];
    const target = candidates.find(existsSync);
    assert.ok(target, `Missing local target for ${href}.`);
    if (url.hash) {
      const id = decodeURIComponent(url.hash.slice(1));
      assert.match(readFileSync(target, 'utf8'), new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`), `Missing fragment target for ${href}.`);
    }
  }
});
