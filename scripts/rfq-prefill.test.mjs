import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const script = read('assets/js/rfq-prefill.js');
const quotePage = read('request-quote.html');
const productsPage = read('products/index.html');
const finder = read('assets/js/product-finder.js');
const flow = read('assets/js/b2b-flow.js');
const handoff = read('assets/js/zari-lab-handoff.js');
const sampleScript = read('assets/js/sample-prefill.js');

test('RFQ page loads the lightweight bridge after the richer Zari Lab handoff', () => {
  assert.match(quotePage, /zari-lab-handoff\.js[^>]+><\/script><script src="\/assets\/js\/rfq-prefill\.js/);
  assert.match(quotePage, /<link rel="canonical" href="https:\/\/suvarnatantu\.com\/request-quote\/">/);
  assert.doesNotMatch(quotePage, /<form[^>]*action=/i);
});

test('RFQ query values are allowlisted for existing editable fields', () => {
  for (const parameter of ['family', 'product', 'application', 'colour', 'finish']) {
    assert.match(script, new RegExp(`${parameter}: \\{`));
  }
  assert.match(script, /Object\.hasOwn\(values, requested\) \? values\[requested\] : ""/);
  for (const field of ['productType', 'product', 'application', 'colour']) {
    assert.match(script, new RegExp(`setEmptyControl\\(form, "${field}"`));
  }
  assert.match(script, /form\.elements\.namedItem\("notes"\)/);
});

test('M, MX, ST and MH map to Product and the verified Metallic Yarn family', () => {
  for (const [slug, label] of [['m-type', 'M Type'], ['mx-type', 'MX Type'], ['st-type', 'ST Type'], ['mh-type', 'MH Type']]) {
    assert.match(script, new RegExp(`"${slug}": "${label}"`));
  }
  assert.match(script, /if \(context\.product\) context\.family = "Metallic Yarn"/);
});

test('family, application, colour and finish mappings match RFQ form options', () => {
  for (const family of ['metallic-yarn', 'zari-yarn', 'colours-finishes', 'filament-yarn', 'twisted-yarn', 'specialty-yarn']) assert.match(script, new RegExp(`"${family}"`));
  for (const application of ['saree', 'jacquard', 'brocade', 'embroidery', 'knitting', 'lace', 'home-furnishing', 'decorative-textiles']) assert.match(script, new RegExp(`(?:"${application}"|${application}):`));
  for (const colour of ['gold', 'silver', 'copper', 'rose-gold', 'antique', 'custom-colour']) assert.match(script, new RegExp(`(?:"${colour}"|${colour}):`));
  for (const finish of ['bright', 'soft-metallic', 'matte', 'antique', 'custom']) assert.match(script, new RegExp(`(?:"${finish}"|${finish}):`));
  assert.doesNotMatch(script, /\bweaving:\s*"Saree Weaving"/);
});

test('Product Finder carries only supported family and application context into RFQ', () => {
  assert.match(finder, /RFQ_APPLICATIONS/);
  assert.match(finder, /RFQ_FAMILIES/);
  assert.match(finder, /family=\$\{family\}/);
  assert.match(finder, /application=\$\{application\}/);
  assert.doesNotMatch(finder.match(/const RFQ_APPLICATIONS[\s\S]*?\}\);/)?.[0] ?? '', /weaving|other/);
  assert.match(productsPage, /href="\/request-quote\/\?family=colours-finishes">Request a Quote/);
});

test('direct and invalid requests remain normal without unsafe raw rendering', () => {
  assert.match(script, /if \(!Object\.keys\(context\)\.length\) return/);
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML|document\.write|eval\(/);
  assert.match(script, /textContent = value/);
  assert.doesNotMatch(script, /requestSubmit\(|\.submit\(|fetch\(|XMLHttpRequest/);
});

test('precedence protects richer Zari Lab and existing session-configured values', () => {
  assert.match(script, /document\.querySelector\("\.zari-handoff-banner"\)/);
  assert.match(script, /String\(control\.value\)\.trim\(\)/);
  assert.match(script, /notes\.value\.trim\(\)/);
  assert.match(flow, /sessionStorage\.getItem\('suvarnatantuB2BConfig'\)/);
  assert.match(handoff, /destinationIntent === "rfq"/);
  assert.doesNotMatch(script, /sessionStorage|localStorage|suvarnatantu_zari_lab_handoff/);
});

test('existing API payload includes reused RFQ fields without a contract change', () => {
  assert.match(flow, /Object\.fromEntries\(Array\.from\(new FormData\(form\)\.entries\(\)/);
  assert.match(flow, /payload: fields/);
  assert.match(flow, /product: fields\.product/);
  assert.match(flow, /category: fields\.productType/);
  assert.match(flow, /https:\/\/vastranand\.com\/v1\/public\/suvarnatantu-enquiries/);
});

test('Task 7 Sample logic remains independent and unchanged in intent', () => {
  assert.match(sampleScript, /path !== "\/samples"/);
  assert.match(sampleScript, /event\.detail\?\.kind === "sample"/);
  assert.match(sampleScript, /sample-context-banner/);
  assert.doesNotMatch(script, /path === "\/samples"|kind === "sample"/);
});

test('no sensitive, pricing, upload or indexing behavior is introduced', () => {
  assert.doesNotMatch(finder + script + productsPage, /[?&](?:name|email|phone|company|quantity|notes|address)=/i);
  assert.doesNotMatch(script + productsPage, /instant price|guaranteed quote|guaranteed moq|guaranteed production|confirmed availability/i);
  assert.doesNotMatch(script, /FileReader|base64|JSON\.stringify\(context\)/i);
});
