import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const page = read('zari-lab/index.html');
const reference = read('assets/js/zari-lab-reference.js');
const configurator = read('assets/js/zari-lab-configurator.js');
const styles = read('assets/css/styles.css');

test('Reference Review is mounted in Zari Lab with the required safe handoff', () => {
  assert.match(page, /id="reference-review"/);
  assert.match(page, /href="#reference-review">Prepare Reference Details/);
  assert.match(page, /Prepare a Yarn or Fabric Reference/);
  assert.match(page, /Prepare Reference Details/);
  assert.match(page, /href="\/samples\/"[^>]*>Request a Sample/);
  assert.match(page, /href="\/request-quote\/"[^>]*>Continue to RFQ/);
  assert.match(page, /Selected files are not transmitted from this page/);
  assert.match(page, /href="\/privacy-policy\/">Privacy Policy/);
  assert.match(page, /zari-lab-reference\.js/);
  assert.doesNotMatch(page, /Submit for Technical Review|Upload Reference Files/);
});

test('Reference types, context, and review choices are complete', () => {
  for (const value of ['Yarn Photo', 'Fabric Photo', 'Specification Sheet', 'Existing Product Reference', 'Physical Sample Available', 'Other']) {
    assert.match(page, new RegExp(`value="${value.replace('/', '\\/')}"`));
  }
  for (const value of ['Colour / Appearance', 'Yarn Type', 'Denier', 'TPM', 'Twist Direction', 'Construction', 'Existing Sample Matching', 'General Technical Review']) {
    assert.ok(page.includes(`value="${value}"`), value);
  }
  assert.match(page, /maxlength="1500"/);
  assert.match(page, /name="physicalSample" value="Yes"/);
  assert.match(page, /name="includeConfigurator"/);
});

test('File handling is allowlisted, bounded, and cleans up previews', () => {
  assert.match(page, /accept="\.jpg,\.jpeg,\.png,\.webp,\.pdf,image\/jpeg,image\/png,image\/webp,application\/pdf"/);
  assert.match(reference, /const MAX_FILES = 5/);
  assert.match(reference, /const MAX_FILE_SIZE = 10 \* 1024 \* 1024/);
  assert.match(reference, /jpg: \['image\/jpeg'\]/);
  assert.match(reference, /pdf: \['application\/pdf'\]/);
  assert.match(reference, /URL\.createObjectURL/);
  assert.match(reference, /URL\.revokeObjectURL/);
  assert.match(reference, /textContent = entry\.file\.name/);
  assert.doesNotMatch(reference, /innerHTML/);
  assert.doesNotMatch(reference, /fetch\(|XMLHttpRequest|FormData/);
});

test('Configurator integration is read-only and summary fields are allowlisted', () => {
  assert.match(configurator, /suvarnatantu:zari-requirement-query/);
  assert.match(configurator, /respond\(\{ \.\.\.state\.data \}\)/);
  assert.doesNotMatch(reference, /sessionStorage\.(?:setItem|removeItem)/);
  for (const label of ['Application', 'Yarn Type', 'Colour', 'Finish', 'Denier', 'TPM', 'Twist', 'Construction', 'Quantity', 'Reference Notes']) {
    assert.ok(reference.includes(`['${label}'`), label);
  }
});

test('Reference Review has responsive and visible-focus styling', () => {
  assert.match(styles, /\.zlh-reference-review__workspace\{display:grid/);
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*\.zlh-reference-fields\{grid-template-columns:1fr\}/);
  assert.match(styles, /@media\(max-width:560px\)[\s\S]*\.zlh-reference-option-grid/);
  assert.match(styles, /\.zlh-reference-review button:focus-visible/);
  assert.match(styles, /overflow-wrap:anywhere/);
});

test('Reference Review avoids automatic analysis and unsafe success claims', () => {
  for (const claim of ['Analyse My Yarn', 'Identify My Yarn', 'Get Exact Match', 'Get Instant Recommendation', 'Reference Submitted', 'Submitted for Technical Review']) {
    assert.doesNotMatch(page, new RegExp(claim));
  }
  assert.doesNotMatch(reference, /Reference submitted|upload successful|enquiry ID/i);
});
