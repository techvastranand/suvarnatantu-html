import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'products', 'index.html'), 'utf8');
const styles = readFileSync(join(root, 'assets', 'css', 'styles.css'), 'utf8');
const zariLab = readFileSync(join(root, 'zari-lab', 'index.html'), 'utf8');
const section = page.match(/<section class="content-section product-zari-guidance"[\s\S]*?<\/section>/)?.[0] ?? '';

const workflows = [
  ['Build Your Requirement', '/zari-lab/#build-your-zari', 'id="build-your-zari"'],
  ['Explore Technical Lab', '/zari-lab/#technical-lab', 'id="technical-lab"'],
  ['Prepare Reference Details', '/zari-lab/#reference-review', 'id="reference-review"'],
  ['Start Troubleshooting', '/zari-lab/#troubleshooting-lab', 'id="troubleshooting-lab"']
];

test('technical guidance follows application discovery and precedes downstream content', () => {
  assert.ok(section, 'Missing Products Zari Lab guidance section.');
  assert.ok(page.indexOf('class="content-section product-applications"') < page.indexOf('class="content-section product-zari-guidance"'));
  assert.ok(page.indexOf('class="content-section product-zari-guidance"') < page.indexOf('B2B buying flow'));
  assert.match(section, /<h2 id="product-zari-guidance-title">Not Sure Which Yarn or Specification You Need\?<\/h2>/);
});

test('all four guidance paths use verified Zari Lab workflow anchors', () => {
  assert.equal((section.match(/class="product-zari-path"/g) ?? []).length, 4);
  for (const [label, route, anchor] of workflows) {
    assert.match(section, new RegExp(`href="${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">${label}`));
    assert.ok(zariLab.includes(anchor), `Missing Zari Lab destination ${anchor}.`);
  }
});

test('Reference Review wording describes preparation without a false upload claim', () => {
  assert.match(section, /I Have a Sample or Reference/);
  assert.match(section, /Prepare Reference Details/);
  assert.doesNotMatch(section, /\bupload(?:ed|ing)?\b/i);
  assert.match(zariLab, /Selected files stay on this device and are not transmitted from this page\./);
});

test('Requirement Brief is explained as a prepared outcome with accurate print wording', () => {
  assert.match(section, /After you prepare a Zari Lab workflow/);
  assert.match(section, /printed or saved as PDF/);
  assert.match(section, /technical and commercial review/);
  assert.doesNotMatch(section, /href="\/zari-lab\/#requirement-brief"/);
  assert.match(zariLab, /data-print-brief disabled>Print \/ Save as PDF/);
  assert.match(zariLab, /No Zari Lab requirement has been prepared yet\./);
});

test('main Zari Lab, Sample and RFQ actions use existing routes', () => {
  assert.match(section, /href="\/zari-lab\/">Open Zari Lab<\/a>/);
  assert.match(section, /href="\/samples\/">Request a Sample<\/a>/);
  assert.match(section, /href="\/request-quote\/">Continue to RFQ<\/a>/);
  assert.doesNotMatch(section, /href=["'](?:#|javascript:|\s*["'])/i);
});

test('guidance remains explanatory static HTML without a second interactive engine', () => {
  assert.doesNotMatch(section, /<script|<form|<select|<input|<button|data-product-finder/i);
  assert.doesNotMatch(section, /automatic (?:approval|diagnosis|price|production)|guaranteed (?:sample|lead time)/i);
});

test('Tasks 1 through 4 remain present with Product Finder JavaScript unchanged', () => {
  assert.match(page, /class="content-section product-finder"/);
  assert.match(page, /class="content-section alt product-catalogue"/);
  assert.match(page, /class="content-section metallic-comparison"/);
  assert.match(page, /class="content-section product-applications"/);
  assert.match(page, /src="\/assets\/js\/product-finder\.js\?v=20260922-1"/);
});

test('guidance uses responsive four, two and one-column layouts with visible focus', () => {
  assert.match(styles, /\.product-zari-guidance__paths\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:1100px\)\{\.product-zari-guidance__paths\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:600px\)\{\.product-zari-guidance__paths,\.product-zari-guidance__flow\{grid-template-columns:1fr\}/);
  assert.match(styles, /\.product-zari-guidance a:focus-visible\{outline:2px solid var\(--gold2\)/);
  assert.doesNotMatch(styles, /\.product-zari-guidance__paths[^}]*overflow-x|\.product-zari-guidance__paths[^}]*white-space:nowrap/);
});
