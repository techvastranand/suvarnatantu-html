import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const flow = read('assets/js/b2b-flow.js');
const loader = read('assets/js/site-shell.js');
const homepage = read('index.html');
const quotePage = read('request-quote.html');
const samplePage = read('samples/index.html');
const thankYouPage = read('enquiry-thank-you/index.html');

const siteSourceFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  if (entry.name === '.git' || entry.name === 'node_modules') return [];
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return siteSourceFiles(path);
  return ['.html', '.js', '.mjs'].includes(extname(entry.name)) ? [path] : [];
});

test('Business, Quote and Sample submissions use only the public intake API', () => {
  assert.match(flow, /https:\/\/vastranand\.com\/v1\/public\/suvarnatantu-enquiries/);
  assert.equal((flow.match(/fetch\(INTAKE_API/g) || []).length, 1);
  assert.match(flow, /includes\('Homepage'\) \? 'business'/);
  assert.match(flow, /includes\('Quote'\) \? 'quote' : 'sample'/);
  assert.match(flow, /name: fields\.full_name \|\| fields\.contact/);
  assert.match(flow, /product: fields\.product/);
  assert.match(flow, /category: fields\.productType/);
  assert.match(homepage, /data-enquiry-form/);
  assert.match(flow, /class="form b2b-request-form" data-enquiry-form/);
});

test('no HTML or JavaScript contains an active FormSubmit target or provider fields', () => {
  for (const path of siteSourceFiles(root)) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /https?:\/\/formsubmit\.co\//i, path);
  }
  const formSources = [homepage, flow].join('\n');
  assert.doesNotMatch(formSources, /name=["']_(?:next|subject|captcha|template|autoresponse|honey)["']/i);
  assert.doesNotMatch(flow, /HTMLFormElement\.prototype\.submit|FORM_ACTION|formSubmitFields/);
  assert.doesNotMatch(homepage, /<form[^>]+\saction=/i);
});

test('API success redirects directly to the existing thank-you page', () => {
  assert.match(flow, /const THANK_YOU_PATH = '\/enquiry-thank-you\/'/);
  assert.match(flow, /await submitIntake\(payload\);[^]*window\.location\.assign\(THANK_YOU_PATH\)/);
});

test('definite failures remain on the form and preserve entered values', () => {
  assert.match(flow, /if \(!response\.ok\)/);
  assert.match(flow, /We couldn\\u2019t submit your enquiry\. Please try again or contact us on WhatsApp\./);
  assert.match(flow, /form\.dataset\.apiSubmitting = 'false'/);
  assert.match(flow, /button\.disabled = false/);
  assert.doesNotMatch(flow, /form\.reset\(/);
});

test('one retained UUID is reused for an ambiguous timeout retry', () => {
  assert.match(flow, /window\.crypto\?\.randomUUID/);
  assert.match(flow, /form\.dataset\.submissionUuid = newSubmissionUuid\(\)/);
  assert.match(flow, /field\.name = 'submission_uuid'/);
  assert.match(flow, /error\?\.name !== 'AbortError'/);
  assert.match(flow, /return postIntake\(payload\)/);
  assert.doesNotMatch(flow, /catch[^]*newSubmissionUuid\(\)/);
});

test('double submission is prevented and a submitting state is shown', () => {
  assert.match(flow, /event\.preventDefault\(\)/);
  assert.match(flow, /if \(form\.dataset\.apiSubmitting === 'true'\) return/);
  assert.match(flow, /form\.dataset\.apiSubmitting = 'true'/);
  assert.match(flow, /button\.disabled = true/);
  assert.match(flow, /Sending enquiry\\u2026/);
  assert.match(homepage, /type="submit"[^>]+disabled/);
  assert.match(flow, /type="submit"[^>]+disabled/);
});

test('quote and sample forms retain the existing product configurator prefill', () => {
  assert.match(flow, /sessionStorage\.setItem\('suvarnatantuB2BConfig'/);
  assert.match(flow, /sessionStorage\.getItem\('suvarnatantuB2BConfig'/);
  assert.match(flow, /Object\.entries\(stored\)\.forEach/);
  assert.match(flow, /saveAndGo\(section\.querySelector\('form'\), button\.dataset\.go\)/);
});

test('all three enquiry routes provide a no-JavaScript WhatsApp alternative', () => {
  for (const source of [homepage, quotePage, samplePage]) {
    assert.match(source, /<noscript/i);
    assert.match(source, /enable JavaScript/i);
    assert.match(source, /https:\/\/wa\.me\/918154000962/);
  }
});

test('the thank-you page uses the required confirmation and existing navigation options', () => {
  assert.match(thankYouPage, /<h1>Thank you for your enquiry<\/h1>/);
  assert.match(thankYouPage, /Your requirement has been received successfully\. Our Suvarnatantu team will review it and contact you shortly\./);
  assert.match(thankYouPage, /href="\/"[^>]*>Return to Homepage/);
  assert.match(thankYouPage, /href="\/products\/"[^>]*>Explore Products/);
  assert.match(thankYouPage, /https:\/\/wa\.me\/918154000962/);
});

test('layout, navigation, SEO markers and the updated flow cache key remain present', () => {
  assert.match(homepage, /<link rel="canonical" href="https:\/\/suvarnatantu\.com\/">/);
  assert.match(homepage, /<nav class="site-nav"/);
  assert.match(quotePage, /<link rel="canonical" href="https:\/\/suvarnatantu\.com\/request-quote\/">/);
  assert.match(samplePage, /<link rel="canonical" href="https:\/\/suvarnatantu\.com\/samples\/">/);
  assert.match(quotePage, /id="site-header-mount"/);
  assert.match(samplePage, /id="site-header-mount"/);
  assert.match(loader, /b2b-flow\.js\?v=20260829-2/);
});
