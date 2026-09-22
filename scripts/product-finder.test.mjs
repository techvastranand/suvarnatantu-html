import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const page = read('products/index.html');
const script = read('assets/js/product-finder.js');
const styles = read('assets/css/styles.css');
const context = vm.createContext({ window: {} });
vm.runInContext(script, context);
const finder = context.window.SuvarnatantuProductFinder;

test('Product Finder follows the hero and preserves the crawlable catalogue', () => {
  assert.ok(page.indexOf('class="page-hero"') < page.indexOf('class="content-section product-finder"'));
  assert.ok(page.indexOf('class="content-section product-finder"') < page.indexOf('Product families'));
  assert.match(page, /href="\/metallic-yarn\/"/);
  assert.match(page, /href="\/zari-yarn\/"/);
  assert.match(page, /href="\/colours\/"/);
  assert.match(page, /href="\/products\/filament-yarn\/"/);
  assert.match(page, /href="\/products\/twisted-yarn\/"/);
});

test('all requested application and supported requirement options are present', () => {
  for (const label of ['Saree', 'Jacquard', 'Brocade', 'Embroidery', 'Knitting', 'Lace', 'Weaving', 'Home Furnishing', 'Decorative Textiles', 'Other / Custom Application']) {
    assert.ok(page.includes(`>${label}</option>`), label);
  }
  for (const label of ['Metallic Yarn', 'Zari Yarn', 'Filament Yarn', 'Twisted Yarn', 'Colour / Finish Requirement', 'Custom Development', 'Not Sure']) {
    assert.ok(page.includes(`>${label}</option>`), label);
  }
});

test('form is labelled, keyboard-native, and exposes accessible dynamic feedback', () => {
  assert.equal((page.match(/<label for="product-finder-/g) || []).length, 3);
  assert.equal((page.match(/<select id="product-finder-/g) || []).length, 3);
  assert.match(page, /<button class="button" type="submit" aria-controls="product-finder-result">/);
  assert.match(page, /aria-describedby="product-finder-validation"/);
  assert.match(page, /aria-controls="product-finder-result"/);
  assert.match(page, /aria-live="polite" aria-atomic="true"/);
  assert.match(page, /data-product-finder-validation role="alert"/);
  assert.match(styles, /\.product-finder__fields select:focus-visible/);
});

test('Metallic Yarn produces a family route without a construction guess', () => {
  const result = finder.recommend({ application: 'saree', requirement: 'metallic-yarn', knowledge: 'some' });
  assert.equal(result.heading, 'Explore Metallic Yarn');
  assert.equal(result.primary.href, '/metallic-yarn/');
  assert.equal(result.secondary.href, '/zari-lab/#build-your-zari');
  assert.doesNotMatch(JSON.stringify(result), /\b(?:M|MX|ST|MH) Type\b/);
});

test('Not Sure prioritizes Zari Lab', () => {
  const result = finder.recommend({ application: 'jacquard', requirement: 'not-sure', knowledge: 'some' });
  assert.equal(result.primary.href, '/zari-lab/#build-your-zari');
  assert.equal(result.primary.label, 'Open Zari Lab');
  assert.match(result.copy, /technical Requirement Brief/);
});

test('Custom Development provides safe technical and commercial routes', () => {
  const guided = finder.recommend({ application: 'embroidery', requirement: 'custom-development', knowledge: 'no' });
  assert.equal(guided.primary.href, '/zari-lab/#build-your-zari');
  assert.equal(guided.secondary.href, '/request-quote/');
  const known = finder.recommend({ application: 'embroidery', requirement: 'custom-development', knowledge: 'yes' });
  assert.equal(known.primary.href, '/request-quote/');
  assert.equal(known.secondary.href, '/samples/');
});

test('known specification routes directly to product family and RFQ', () => {
  const result = finder.recommend({ application: 'weaving', requirement: 'twisted-yarn', knowledge: 'yes' });
  assert.equal(result.primary.href, '/products/twisted-yarn/');
  assert.equal(result.secondary.href, '/request-quote/');
});

test('missing or unsupported selections never produce an invalid result', () => {
  assert.equal(finder.recommend({}), null);
  assert.equal(finder.recommend({ application: 'saree', requirement: '', knowledge: 'yes' }), null);
  assert.equal(finder.recommend({ application: 'saree', requirement: 'mh-type', knowledge: 'yes' }), null);
  assert.match(script, /Choose an application, requirement and specification knowledge/);
});

test('every configured internal route resolves to an existing site page', () => {
  const routes = new Set([
    ...Object.values(finder.APPLICATIONS).map(item => item.href),
    ...Object.values(finder.REQUIREMENTS).map(item => item.href),
    '/zari-lab/', '/request-quote/', '/samples/', '/products/'
  ]);
  const routeExists = route => {
    const clean = route.split('#')[0].replace(/^\//, '').replace(/\/$/, '');
    return existsSync(join(root, clean, 'index.html')) || existsSync(join(root, `${clean}.html`));
  };
  for (const route of routes) assert.ok(routeExists(route), route);
});

test('responsive rules stack controls and protect narrow layouts', () => {
  assert.match(styles, /@media\(max-width:1024px\)[^{]*\{[^}]*\.product-finder__layout\{grid-template-columns:1fr/);
  assert.match(styles, /@media\(max-width:768px\)[^{]*\{[^}]*\.product-finder__fields\{grid-template-columns:1fr/);
  assert.match(styles, /@media\(max-width:390px\)/);
  assert.match(styles, /\.product-finder__submit \.button\{width:100%\}/);
});
