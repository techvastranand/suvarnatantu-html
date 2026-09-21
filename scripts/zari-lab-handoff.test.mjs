import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(new URL(path, `file:///${root.replaceAll('\\', '/')}/`), 'utf8');
const handoff = read('assets/js/zari-lab-handoff.js');
const brief = read('assets/js/zari-lab-brief.js');
const flow = read('assets/js/b2b-flow.js');
const css = read('assets/css/styles.css');
const zariPage = read('zari-lab/index.html');
const samplePage = read('samples/index.html');
const quotePage = read('request-quote.html');

test('Zari Lab and both destinations load the shared handoff bridge', () => {
  assert.match(zariPage, /zari-lab-brief\.js[^>]+><\/script>\s*<script src="\/assets\/js\/zari-lab-handoff\.js/);
  assert.match(samplePage, /zari-lab-handoff\.js/);
  assert.match(quotePage, /zari-lab-handoff\.js/);
});

test('handoff is session-only, versioned, intent-bound, and expires', () => {
  assert.match(handoff, /suvarnatantu_zari_lab_handoff/);
  assert.match(handoff, /sessionStorage\.setItem/);
  assert.match(handoff, /sessionStorage\.removeItem/);
  assert.doesNotMatch(handoff, /localStorage|URLSearchParams|searchParams/);
  assert.match(handoff, /SCHEMA_VERSION\s*=\s*1/);
  assert.match(handoff, /MAX_AGE_MS\s*=\s*4 \* 60 \* 60 \* 1000/);
  assert.match(handoff, /destinationIntent/);
  assert.match(handoff, /preparedAt/);
});

test('handoff consumes the normalized Unified Brief source', () => {
  assert.match(brief, /suvarnatantu:zari-brief-query/);
  assert.match(brief, /requirement:\s*\{/);
  assert.match(handoff, /queryNormalizedBrief/);
  assert.match(handoff, /suvarnatantu:zari-brief-query/);
  assert.doesNotMatch(handoff, /zari-requirement-query|zari-reference-query|zari-troubleshooting-query/);
});

test('destination UI supports review, ignore, and protected overwrite choices', () => {
  for (const label of [
    'Use Zari Lab Requirement', 'Review First', 'Ignore', 'Use This Requirement',
    'Fill Empty Fields Only (Recommended)', 'Replace Matching Fields', 'Cancel'
  ]) assert.match(handoff, new RegExp(label.replace(/[()]/g, '\\$&')));
  assert.match(handoff, /role", "alertdialog/);
  assert.match(handoff, /aria-modal/);
  assert.match(handoff, /event\.key === "Escape"/);
  assert.match(handoff, /event\.key !== "Tab"/);
  assert.match(css, /\.zari-handoff-banner/);
  assert.match(css, /@media\(max-width:640px\).*\.zari-handoff-summary/);
});

test('mapping is allowlisted and review-required values cannot enter quantity', () => {
  for (const field of ['application', 'product', 'colour', 'denier', 'tpm', 'twist', 'quantity', 'unit', 'requirementType', 'notes']) {
    assert.match(handoff, new RegExp(`(?:add|namedItem)\\(\\"${field}\\"`));
  }
  for (const protectedField of ['company', 'contact', 'email', 'phone', 'country', 'state', 'city', 'taxId', 'address', 'postalCode', 'consent']) {
    assert.doesNotMatch(handoff, new RegExp(`(?:add|namedItem)\\(\\"${protectedField}\\"`));
  }
  assert.match(handoff, /if \(!value \|\| isReviewValue\(value\)\) return null/);
  assert.match(handoff, /Zari Lab Technical Requirement/);
  assert.match(handoff, /Reference file was selected in Zari Lab but is not attached to this enquiry/);
});

test('existing submission API contract stays intact and exposes lifecycle events only', () => {
  assert.match(flow, /https:\/\/vastranand\.com\/v1\/public\/suvarnatantu-enquiries/);
  assert.match(flow, /body:\s*JSON\.stringify\(payload\)/);
  assert.match(flow, /suvarnatantu:b2b-form-ready/);
  assert.match(flow, /suvarnatantu:enquiry-submitted/);
  assert.doesNotMatch(flow, /zari_lab_handoff/);
});

test('reference handoff stores metadata only', () => {
  assert.match(handoff, /name:\s*cleanString\(file\.name/);
  assert.match(handoff, /type:\s*cleanString\(file\.type/);
  assert.match(handoff, /Math\.round\(Number\(file\.size\)\)/);
  assert.doesNotMatch(handoff, /FileReader|readAsDataURL|arrayBuffer|file\.(?:content|data)\b/);
});
