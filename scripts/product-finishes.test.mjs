import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'products', 'index.html'), 'utf8');
const styles = readFileSync(join(root, 'assets', 'css', 'styles.css'), 'utf8');
const colourHub = readFileSync(join(root, 'colours', 'index.html'), 'utf8');
const zariLab = readFileSync(join(root, 'zari-lab', 'index.html'), 'utf8');
const section = page.match(/<section class="content-section product-finishes"[\s\S]*?<\/section>/)?.[0] ?? '';

const colours = [
  ['Gold', '/colours/gold/'],
  ['Silver', '/colours/silver/'],
  ['Copper', '/colours/copper/'],
  ['Rose Gold', '/colours/rose-gold/'],
  ['Antique', '/colours/antique/'],
  ['Custom Colour', '/colours/custom/']
];
const finishes = ['Bright', 'Soft Metallic', 'Matte', 'Antique', 'Custom'];

function routeExists(route) {
  const relative = route.replace(/^\//, '').replace(/\/$/, '');
  return existsSync(join(root, relative, 'index.html')) || existsSync(join(root, `${relative}.html`));
}

test('colour and finish discovery follows Applications and precedes Technical Guidance', () => {
  assert.ok(section, 'Missing colour and finish discovery section.');
  assert.ok(page.indexOf('class="content-section product-applications"') < page.indexOf('class="content-section product-finishes"'));
  assert.ok(page.indexOf('class="content-section product-finishes"') < page.indexOf('class="content-section product-zari-guidance"'));
  assert.match(section, /<h2 id="product-finishes-title">Explore Colour &amp; Finish Directions<\/h2>/);
});

test('all six routed directions match the existing Colours hub and local pages', () => {
  assert.equal((section.match(/class="product-finish-card"/g) ?? []).length, colours.length);
  for (const [name, route] of colours) {
    assert.ok(colourHub.includes(`<strong>${name}</strong>`), `${name} is absent from the Colours hub.`);
    assert.ok(colourHub.includes(`href="${route}"`), `${route} is absent from the Colours hub.`);
    assert.ok(section.includes(`href="${route}"`), `${route} is absent from the Products discovery section.`);
    assert.ok(routeExists(route), `${route} has no local page.`);
  }
});

test('finish terminology is verified in Zari Lab without invented individual routes', () => {
  for (const finish of finishes) {
    assert.ok(zariLab.includes(`data-finish="${finish}"`), `${finish} is absent from Zari Lab.`);
    assert.match(section, new RegExp(`<dt>${finish}<\\/dt>`));
  }
  assert.doesNotMatch(section, /href="\/(?:colours|finishes)\/(?:bright|soft-metallic|matte)\//);
  assert.equal((section.match(/href="\/zari-lab\/#colour-finish-lab"/g) ?? []).length, 1);
});

test('physical sample disclaimer avoids false screen-colour accuracy', () => {
  assert.match(section, /Screen appearance may vary from the physical yarn\./);
  assert.match(section, /Final colour and finish should be confirmed against an approved sample\./);
  assert.doesNotMatch(section, /exact (?:screen )?match|colour accuracy guaranteed|guaranteed reproduction/i);
});

test('custom and special-finish routes use verified existing destinations', () => {
  assert.match(section, /href="\/colours\/custom\/">Explore Custom Colour/);
  assert.match(section, /href="\/products\/metallic-zari\/special-finish-metallic-zari\/">Explore Special Finish/);
  assert.ok(routeExists('/products/metallic-zari/special-finish-metallic-zari/'));
  assert.doesNotMatch(section, /exact colour matching|guaranteed reproduction/i);
});

test('Zari Lab, Sample and RFQ actions are valid crawlable links', () => {
  assert.match(section, /href="\/zari-lab\/#colour-finish-lab">Open Colour &amp; Finish Lab<\/a>/);
  assert.match(section, /href="\/samples\/">Request a Sample/);
  assert.match(section, /href="\/request-quote\/\?family=colours-finishes">Request a Quote/);
  assert.doesNotMatch(section, /href=["'](?:#|javascript:|\s*["'])/i);
});

test('discovery is static HTML with no picker, production JavaScript or images', () => {
  assert.doesNotMatch(section, /<script|<form|<select|<input|type="color"|canvas|<img/i);
  assert.doesNotMatch(section, /HEX|RGB|Pantone|colour wheel/i);
});

test('Tasks 1 through 5 remain present with Product Finder JavaScript unchanged', () => {
  assert.match(page, /class="content-section product-finder"/);
  assert.match(page, /class="content-section alt product-catalogue"/);
  assert.match(page, /class="content-section metallic-comparison"/);
  assert.match(page, /class="content-section product-applications"/);
  assert.match(page, /class="content-section product-zari-guidance"/);
  assert.match(page, /src="\/assets\/js\/product-finder\.js\?v=20260922-1"/);
});

test('colour cards use responsive layouts and keep the compact review flow visible', () => {
  assert.match(styles, /\.product-finish-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:900px\)\{\.product-finish-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:600px\)\{\.product-finish-grid,\.product-finishes__terms\{grid-template-columns:1fr\}\.product-finishes__flow\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.product-finishes a:focus-visible\{outline:2px solid var\(--gold2\)/);
  assert.doesNotMatch(styles, /\.product-finish-grid[^}]*overflow-x|\.product-finish-grid[^}]*white-space:nowrap/);
});
