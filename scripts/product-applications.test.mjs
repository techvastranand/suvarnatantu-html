import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'products', 'index.html'), 'utf8');
const styles = readFileSync(join(root, 'assets', 'css', 'styles.css'), 'utf8');
const applicationHub = readFileSync(join(root, 'applications', 'index.html'), 'utf8');
const section = page.match(/<section class="content-section product-applications"[\s\S]*?<\/section>/)?.[0] ?? '';

const applications = [
  ['Saree', '/applications/saree/', 'Explore borders, pallu, butta, motifs and decorative woven effects.'],
  ['Jacquard', '/applications/jacquard/', 'Explore pattern-led woven textiles using metallic or zari effects.'],
  ['Brocade', '/applications/brocade/', 'Explore decorative woven fabrics where metallic appearance forms part of the design.'],
  ['Embroidery', '/applications/embroidery/', 'Explore metallic and zari effects for decorative embroidery applications.'],
  ['Knitting', '/applications/knitting/', 'Explore metallic-textile effects for relevant knitted fabric requirements.'],
  ['Lace', '/applications/lace/', 'Explore metallic decorative effects for lace and narrow-textile applications.'],
  ['Weaving', '/applications/weaving/', 'Explore application-led yarn selection for woven textile development.'],
  ['Home Furnishing', '/applications/home-furnishing/', 'Explore decorative metallic effects for furnishing-textile applications.'],
  ['Decorative Textiles', '/applications/decorative-textiles/', 'Explore specialty textile applications driven by colour, finish and visual effect.']
];

function count(value, needle) {
  return value.split(needle).length - 1;
}

function routeExists(route) {
  const relative = route.replace(/^\//, '').replace(/\/$/, '');
  return existsSync(join(root, relative, 'index.html')) || existsSync(join(root, `${relative}.html`));
}

test('application discovery follows the metallic comparison and precedes downstream content', () => {
  assert.ok(section, 'Missing product application section.');
  assert.ok(page.indexOf('class="metallic-comparison"') < page.indexOf('class="content-section product-applications"'));
  assert.ok(page.indexOf('class="content-section product-applications"') < page.indexOf('class="content-section product-finishes"'));
  assert.match(section, /<h2 id="product-applications-title">Explore Yarn by Application<\/h2>/);
});

test('all nine applications from the current hub appear exactly once', () => {
  assert.equal(count(section, 'class="product-application-card"'), applications.length);
  for (const [name, route, copy] of applications) {
    assert.equal(count(section, `<h3>${name}</h3>`), 1, `${name} should appear once.`);
    assert.equal(count(section, `href="${route}"`), 1, `${route} should appear once.`);
    assert.ok(section.includes(copy), `Missing verified copy for ${name}.`);
  }
});

test('application names, routes and copy are traceable to the existing application hub', () => {
  for (const [name, route, copy] of applications) {
    assert.ok(applicationHub.includes(`<h3>${name}</h3>`), `${name} is absent from the hub.`);
    assert.ok(applicationHub.includes(`href="${route}"`), `${route} is absent from the hub.`);
    assert.ok(applicationHub.toLowerCase().includes(copy.replace(/^Explore /, '').toLowerCase()), `Card copy for ${name} is not traceable.`);
    assert.ok(routeExists(route), `${route} has no local application page.`);
  }
});

test('cards provide crawlable descriptive links without placeholders or deterministic product mapping', () => {
  assert.doesNotMatch(section, /href=["'](?:#|javascript:|\s*["'])/i);
  assert.doesNotMatch(section, /(?:Saree|Jacquard|Brocade|Embroidery|Knitting|Lace|Weaving)\s*(?:=|requires?|needs?)\s*(?:M|MX|ST|MH)\s*Type/i);
  assert.equal(section.match(/<a href="\/applications\/[^\"]+\/">Explore [^<]+ Application/g)?.length, 9);
  assert.doesNotMatch(section, /<script|<select|<form|data-product-finder/i);
});

test('compact assistance handoff keeps the existing Zari Lab route and contextual samples', () => {
  assert.match(section, /Know the application, but not the yarn\?/);
  assert.match(section, /href="\/zari-lab\/#build-your-zari">Prepare it in Zari Lab/);
  assert.equal(section.match(/href="\/samples\/\?application=/g)?.length, 8);
});

test('Product Finder, catalogue and metallic comparison remain present', () => {
  assert.match(page, /class="content-section product-finder"/);
  assert.match(page, /class="content-section alt product-catalogue"/);
  assert.match(page, /class="content-section metallic-comparison"/);
  assert.match(page, /src="\/assets\/js\/product-finder\.js\?v=20260922-1"/);
});

test('application cards are a responsive static grid with visible keyboard focus', () => {
  assert.match(styles, /\.product-application-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:900px\)\{\.product-application-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:600px\)\{\.product-application-grid\{grid-template-columns:1fr\}/);
  assert.match(styles, /\.product-applications a:focus-visible\{outline:2px solid var\(--gold2\)/);
  assert.doesNotMatch(styles, /\.product-application-grid[^}]*overflow-x|\.product-application-grid[^}]*white-space:nowrap/);
});
