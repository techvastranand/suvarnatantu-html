import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const page = read('zari-lab/index.html');
const troubleshooting = read('assets/js/zari-lab-troubleshooting.js');
const styles = read('assets/css/styles.css');

test('Troubleshooting Lab is mounted as a six-step on-page workflow', () => {
  assert.match(page, /id="troubleshooting-lab"/);
  assert.match(page, /href="#troubleshooting-lab"/);
  assert.match(page, /What Are You Trying to Solve\?/);
  assert.match(page, /Step 1 of 6/);
  assert.equal((page.match(/data-troubleshooting-step="[0-4]"/g) || []).length, 5);
  assert.match(page, /Technical Review Brief/);
  assert.match(page, /zari-lab-troubleshooting\.js/);
});

test('All required problem, desired-result, and reference choices are present', () => {
  for (const value of [
    'Colour / Appearance', 'Metallic Shine / Finish', 'Yarn Breakage Concern', 'Twist Concern',
    'TPM Concern', 'Denier Concern', 'Construction Concern', 'Existing Sample Matching',
    'Yarn Type / Product Selection', 'Production Consistency Concern', 'Not Sure', 'Other'
  ]) assert.ok(page.includes(`value="${value}"`), value);
  for (const value of ['Match an existing reference', 'Develop a new sample', 'Understand current specification']) {
    assert.ok(page.includes(`value="${value}"`), value);
  }
  for (const value of ['Yarn Photo', 'Fabric Photo', 'Specification Sheet', 'Physical Yarn Sample', 'Fabric Sample', 'No Reference']) {
    assert.ok(page.includes(`value="${value}"`), value);
  }
});

test('Troubleshooting draft persists only in its own namespaced session key', () => {
  assert.match(troubleshooting, /suvarnatantu_zari_lab_troubleshooting/);
  assert.match(troubleshooting, /sessionStorage\.setItem\(STORAGE_KEY/);
  assert.match(troubleshooting, /sessionStorage\.removeItem\(STORAGE_KEY/);
  assert.doesNotMatch(troubleshooting, /sessionStorage\.(?:setItem|removeItem)\(['"]suvarnatantu_zari_lab_draft/);
  assert.doesNotMatch(troubleshooting, /FileReader|FormData|\.files\b/);
});

test('Existing data integrations are read-only and ignore educational visual values', () => {
  for (const event of [
    'suvarnatantu:zari-requirement-query', 'suvarnatantu:zari-reference-query',
    'suvarnatantu:zari-colour-lab-state-query', 'suvarnatantu:zari-twist-lab-state-query',
    'suvarnatantu:zari-tpm-lab-state-query', 'suvarnatantu:zari-denier-lab-state-query',
    'suvarnatantu:zari-construction-lab-state-query'
  ]) assert.ok(troubleshooting.includes(event), event);
  assert.doesNotMatch(troubleshooting, /zari-(?:colour|twist|tpm|denier|construction)-apply/);
  assert.doesNotMatch(troubleshooting, /density-slider|fineness-slider|construction-view|comparison-mode/);
});

test('Summary routes to existing reference, sample, and RFQ paths', () => {
  assert.match(page, /href="#reference-review">Prepare Reference Details/);
  assert.match(page, /href="\/samples\/">Request a Sample/);
  assert.match(page, /href="\/request-quote\/">Continue to RFQ/);
  assert.match(page, /This brief summarises buyer-provided information and observations/);
  assert.match(page, /Start a new troubleshooting brief\?/);
  assert.match(page, /Your current troubleshooting selections will be cleared\./);
});

test('Troubleshooting UI is responsive and keyboard-visible', () => {
  assert.match(styles, /\.zlh-troubleshooting__workspace\{max-width:1180px/);
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*\.zlh-troubleshooting-options/);
  assert.match(styles, /@media\(max-width:560px\)[\s\S]*\.zlh-troubleshooting__progress ol\{display:none\}/);
  assert.match(styles, /\.zlh-troubleshooting button:focus-visible/);
  assert.match(styles, /overflow-wrap:anywhere/);
});

test('No diagnosis, exact-match promise, or technical recommendation engine is present', () => {
  assert.doesNotMatch(troubleshooting, /root cause|likely cause|reduce TPM|increase TPM|choose M Type|choose MX Type/i);
  assert.doesNotMatch(page, /Root Cause Identified|Technical Conclusion|Get Exact Match|Exact Match Guaranteed/i);
  assert.match(page, /does not diagnose a root cause or final solution/);
});
