import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const script = read('assets/js/sample-prefill.js');
const samplePage = read('samples/index.html');
const productsPage = read('products/index.html');
const flow = read('assets/js/b2b-flow.js');
const handoff = read('assets/js/zari-lab-handoff.js');

test('Sample page loads the context bridge after the richer Zari Lab handoff', () => {
  assert.match(samplePage, /zari-lab-handoff\.js[^>]+><\/script><script src="\/assets\/js\/sample-prefill\.js/);
  assert.match(samplePage, /<link rel="canonical" href="https:\/\/suvarnatantu\.com\/samples\/">/);
  assert.doesNotMatch(samplePage, /<form[^>]*action=/i);
});

test('query values are allowlisted for existing editable form fields', () => {
  for (const parameter of ['family', 'product', 'application', 'colour', 'finish']) {
    assert.match(script, new RegExp(`${parameter}: \\{`));
    assert.match(script, new RegExp(`params\\.get\\(key\\)`));
  }
  for (const field of ['productType', 'product', 'application', 'colour']) {
    assert.match(script, new RegExp(`setControl\\(form, "${field}"`));
  }
  assert.match(script, /form\.elements\.namedItem\("notes"\)/);
  assert.match(script, /Finish: \$\{finish\}/);
});

test('remaining product-family cards and metallic-type links use stable context values', () => {
  for (const family of ['metallic-yarn', 'zari-yarn', 'colours-finishes']) {
    assert.match(productsPage, new RegExp(`href="/samples/\\?family=${family}"`));
  }
  for (const product of ['m-type', 'mx-type', 'st-type', 'mh-type']) {
    assert.match(productsPage, new RegExp(`href="/samples/\\?family=metallic-yarn&amp;product=${product}"`));
  }
});

test('supported application, colour and finish links match their whitelists', () => {
  for (const application of ['saree', 'jacquard', 'brocade', 'embroidery', 'knitting', 'lace', 'home-furnishing', 'decorative-textiles']) {
    assert.match(productsPage, new RegExp(`href="/samples/\\?application=${application}"`));
    assert.match(script, new RegExp(`(?:"${application}"|${application}):`));
  }
  for (const colour of ['gold', 'silver', 'copper', 'rose-gold', 'antique', 'custom-colour']) {
    assert.match(productsPage, new RegExp(`href="/samples/\\?colour=${colour}"`));
  }
  for (const finish of ['bright', 'soft-metallic', 'matte', 'antique', 'custom']) {
    assert.match(productsPage, new RegExp(`href="/samples/\\?finish=${finish}"`));
  }
  assert.doesNotMatch(productsPage, /[?&](?:name|email|phone|address|notes)=/i);
});

test('invalid values are ignored and no raw query text reaches the DOM', () => {
  assert.match(script, /Object\.hasOwn\(values, requested\) \? values\[requested\] : ""/);
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML|document\.write|eval\(/);
  assert.match(script, /textContent = label/);
  assert.match(script, /textContent = value/);
});

test('direct visits remain unchanged and valid context is visible and editable', () => {
  assert.match(script, /if \(!Object\.keys\(context\)\.length\) return/);
  assert.match(script, /Sample request context/);
  assert.match(script, /Review or change the fields below before submitting/);
  assert.doesNotMatch(script, /disabled\s*=|readOnly\s*=|requestSubmit\(|\.submit\(/);
});

test('Zari Lab remains the authoritative richer path', () => {
  assert.match(script, /document\.querySelector\("\.zari-handoff-banner"\)/);
  assert.match(handoff, /sessionStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(handoff, /Use Zari Lab Requirement/);
  assert.match(handoff, /buildTechnicalNotes/);
  assert.doesNotMatch(script, /suvarnatantu_zari_lab_handoff|sessionStorage|localStorage/);
});

test('existing submission contract includes prefilled controls without API changes', () => {
  assert.match(flow, /Object\.fromEntries\(Array\.from\(new FormData\(form\)\.entries\(\)/);
  assert.match(flow, /payload: fields/);
  assert.match(flow, /product: fields\.product/);
  assert.match(flow, /category: fields\.productType/);
  assert.match(flow, /https:\/\/vastranand\.com\/v1\/public\/suvarnatantu-enquiries/);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|indexedDB/);
});

test('no upload, autosubmit, promise or query-indexing behavior is introduced', () => {
  assert.doesNotMatch(script + productsPage, /free sample|guaranteed sample|ships immediately|approved automatically/i);
  assert.doesNotMatch(script, /FileReader|type\s*=\s*["']file|base64/i);
  assert.doesNotMatch(productsPage, /\/samples\/\?[^"']*(?:sitemap|canonical)/i);
});
