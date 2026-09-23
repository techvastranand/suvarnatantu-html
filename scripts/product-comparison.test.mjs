import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const page = read('products/index.html');
const styles = read('assets/css/styles.css');
const start = page.indexOf('<section class="content-section metallic-comparison"');
const end = page.indexOf('<section class="content-section product-applications"', start);
const comparison = page.slice(start, end);
const sources = {
  m: read('metallic-yarn/m-type/index.html'),
  mx: read('metallic-yarn/mx-type/index.html'),
  st: read('metallic-yarn/st-type/index.html'),
  mh: read('metallic-yarn/mh-type/index.html')
};

const routeExists = route => existsSync(join(root, route.replace(/^\//, ''), 'index.html'));

test('comparison follows the family catalogue and precedes downstream content', () => {
  assert.ok(start > page.indexOf('class="content-section alt product-catalogue"'));
  assert.ok(end > start);
  assert.match(comparison, /METALLIC YARN GUIDE/i);
  assert.match(comparison, /Compare M, MX, ST &amp; MH Types/);
});

test('desktop comparison uses correctly scoped semantic table headers', () => {
  assert.match(comparison, /<table class="metallic-comparison__table">/);
  assert.equal((comparison.match(/<th scope="col">/g) || []).length, 5);
  assert.equal((comparison.match(/<th scope="row">/g) || []).length, 5);
  for (const label of ['Construction', 'Support / core', 'How components combine', 'Common variables', 'Technical review focus']) {
    assert.ok(comparison.includes(`>${label}</th>`), label);
  }
});

test('four equivalent mobile product cards remain static and indexable', () => {
  assert.equal((comparison.match(/<article class="metallic-comparison-card">/g) || []).length, 4);
  for (const type of ['M Type', 'MX Type', 'ST Type', 'MH Type']) {
    assert.equal((comparison.match(new RegExp(`<h3>${type}</h3>`, 'g')) || []).length, 1);
  }
  assert.doesNotMatch(comparison, /<script|data-(?:render|comparison)/);
});

test('all construction statements are traceable to the four product pages', () => {
  assert.ok(sources.m.includes('Flat metallic-film construction'));
  assert.ok(sources.m.includes('without the support-filament structure used in MX, ST or MH'));
  assert.ok(sources.m.includes('Used directly or as a metallic component in other yarn constructions'));

  assert.ok(sources.mx.includes('M-Type metallic film with two supporting filament ends'));
  assert.ok(sources.mx.includes('Polyester or nylon'));
  assert.ok(sources.mx.includes('Balanced clockwise and counter-clockwise support where specified'));

  assert.ok(sources.st.includes('Textile core covered with metallic flat film'));
  assert.ok(sources.st.includes('Polyester, rayon / viscose or nylon'));
  assert.ok(sources.st.includes('Wrapped around the core yarn'));

  assert.ok(sources.mh.includes('Metallic flat film twisted with supporting textile filament'));
  assert.ok(sources.mh.includes('Polyester, nylon or rayon'));
  assert.ok(sources.mh.includes('made by twisting M-Type metallic flat yarn with'));
});

test('common variables and review focus are supported without numeric values', () => {
  for (const needle of ['film width, thickness, metallic finish and colour direction', 'intended process, required appearance and available sample or buyer specification']) assert.ok(sources.m.toLowerCase().includes(needle));
  for (const needle of ['film width and thickness, support yarn, denier, twist and final construction', 'machine, textile application, required appearance and any buyer sample']) assert.ok(sources.mx.toLowerCase().includes(needle));
  for (const needle of ['core material and denier, metallic-film width and thickness, covering level, twist direction and colour', 'intended process']) assert.ok(sources.st.toLowerCase().includes(needle));
  for (const needle of ['metallic-film width, support filament, denier, twist, tpm, colour and finish', 'machine conditions, fabric construction and the desired textile effect']) assert.ok(sources.mh.toLowerCase().includes(needle));
  assert.doesNotMatch(comparison, /\b\d+(?:\.\d+)?\s*(?:d|denier|tpm|mm|micron|Î¼|%)\b/i);
});

test('comparison avoids rankings, promises, and unsupported performance claims', () => {
  assert.doesNotMatch(comparison, /\b(?:best|better|premium|recommended|most suitable|superior|cheapest|strongest)\b/i);
  assert.doesNotMatch(comparison, /heat resistance|wash performance|elongation|strength|dyeing behavio(?:u)?r|guarantee/i);
  assert.match(comparison, /final construction and specification should be confirmed through technical review/);
});

test('all product details and contextual sample links use verified routes', () => {
  for (const route of ['/metallic-yarn/m-type/', '/metallic-yarn/mx-type/', '/metallic-yarn/st-type/', '/metallic-yarn/mh-type/']) {
    assert.equal((comparison.match(new RegExp(`href="${route}"`, 'g')) || []).length, 2);
    assert.ok(routeExists(route), route);
  }
  assert.equal((comparison.match(/href="\/samples\/\?family=metallic-yarn&amp;product=/g) || []).length, 4);
  assert.ok(routeExists('/samples/'));
  assert.doesNotMatch(comparison, /href="(?:#|javascript:)/);
});

test('responsive styles swap the table for readable mobile cards without page overflow', () => {
  assert.match(styles, /\.metallic-comparison__table\{width:100%/);
  assert.match(styles, /@media\(max-width:768px\)[^{]*\{\.metallic-comparison__table-wrap\{display:none\}\.metallic-comparison__mobile\{display:grid/);
  assert.match(styles, /@media\(max-width:620px\)\{\.metallic-comparison__mobile\{grid-template-columns:1fr/);
  assert.match(styles, /\.metallic-comparison a:focus-visible/);
});
