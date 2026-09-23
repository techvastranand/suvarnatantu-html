import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const page = read('products/index.html');
const styles = read('assets/css/styles.css');
const start = page.indexOf('<section class="content-section alt product-catalogue"');
const end = page.indexOf('<section class="content-section metallic-comparison"', start);
const catalogue = page.slice(start, end);

const routeExists = route => {
  const clean = route.split('#')[0].replace(/^\//, '').replace(/\/$/, '');
  return existsSync(join(root, clean, 'index.html')) || existsSync(join(root, `${clean}.html`));
};

test('the three retained product families are rendered as crawlable HTML cards', () => {
  const families = ['metallic-yarn', 'zari-yarn', 'colours-finishes'];
  assert.equal((catalogue.match(/<article class="product-family-card"/g) || []).length, 3);
  for (const family of families) assert.match(catalogue, new RegExp(`data-product-family="${family}"`));
  for (const heading of ['Metallic Yarn', 'Zari Yarn', 'Colours &amp; Finishes']) {
    assert.match(catalogue, new RegExp(`<h3><a[^>]+>${heading}</a></h3>`));
  }
  for (const family of ['filament-yarn', 'twisted-yarn', 'specialty-yarn']) {
    assert.doesNotMatch(catalogue, new RegExp(`data-product-family="${family}"`));
  }
});

test('Metallic Yarn retains every verified construction route', () => {
  for (const [label, route] of [
    ['M Type', '/metallic-yarn/m-type/'],
    ['MX Type', '/metallic-yarn/mx-type/'],
    ['ST Type', '/metallic-yarn/st-type/'],
    ['MH Type', '/metallic-yarn/mh-type/'],
    ['Custom Metallic Yarn', '/metallic-yarn/custom/']
  ]) assert.match(catalogue, new RegExp(`href="${route}">${label}</a>`));
});

test('Zari and colour links use verified routes', () => {
  const routes = [
    '/zari-yarn/weaving-zari/', '/zari-yarn/embroidery-zari/', '/zari-yarn/imitation-zari/',
    '/zari-yarn/polyester-zari/', '/zari-yarn/coloured-zari/', '/colours/gold/', '/colours/silver/',
    '/colours/copper/', '/colours/rose-gold/', '/colours/antique/', '/colours/custom/'
  ];
  for (const route of routes) {
    assert.ok(catalogue.includes(`href="${route}"`), route);
    assert.ok(routeExists(route), route);
  }
});

test('every family has a valid contextual Sample request link', () => {
  for (const family of ['metallic-yarn', 'zari-yarn', 'colours-finishes']) {
    assert.match(catalogue, new RegExp(`class="text-link" href="/samples/\\?family=${family}">Request Sample`));
  }
  assert.ok(routeExists('/samples/'));
  assert.doesNotMatch(catalogue, /href="\/samples\/\?(?!family=(?:metallic-yarn|zari-yarn|colours-finishes)\b)/);
});

test('cards contain parameter names without invented numeric specifications', () => {
  for (const label of ['Construction', 'Denier', 'TPM', 'Colour', 'Finish', 'Application']) {
    assert.ok(catalogue.includes(`<li>${label}</li>`), label);
  }
  assert.doesNotMatch(catalogue, /\b\d+(?:\.\d+)?\s*(?:denier|tpm|mm|micron|%|°c)\b/i);
  assert.doesNotMatch(catalogue, /strength|heat resistance|composition percentage/i);
});

test('catalogue remains useful without JavaScript and Product Finder stays present', () => {
  assert.ok(start > page.indexOf('data-product-finder'));
  assert.match(page, /product-finder\.js\?v=20260922-1/);
  assert.ok((catalogue.match(/<a [^>]*href="\//g) || []).length >= 20);
  assert.doesNotMatch(catalogue, /href="(?:#|javascript:)/);
});

test('catalogue has visible focus and responsive grid rules', () => {
  assert.match(styles, /\.product-catalogue a:focus-visible/);
  assert.match(styles, /\.product-family-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:1100px\)\{\.product-family-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:720px\)\{\.product-family-grid\{grid-template-columns:1fr/);
  assert.match(styles, /@media\(max-width:390px\)/);
});
