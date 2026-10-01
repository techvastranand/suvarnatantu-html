import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

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

test('Business, Quote and Sample send the verified endpoint, method, type and source', async () => {
  for (const [declaredType, expectedType, reference] of [
    ['Homepage Business Enquiry', 'business', 'STB-000007'],
    ['Request Quote / RFQ', 'quote', 'STQ-000007'],
    ['Request Sample', 'sample', 'STS-000007'],
  ]) {
    const harness = createSubmissionHarness({
      fields: formFields(declaredType),
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ data: { accepted: true, reference } }),
      }),
    });
    await harness.submit();
    assert.equal(harness.requests.length, 1);
    const request = harness.requests[0];
    assert.equal(request.url, 'https://vastranand.com/v1/public/suvarnatantu-enquiries');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers['Content-Type'], 'application/json');
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.enquiry_type, expectedType);
    assert.equal(payload.source_page, formFields(declaredType).source_url);
    assert.equal(payload.payload.quantity, '100');
    assert.equal(payload.payload.notes, 'Gold yarn for weaving');
    assert.deepEqual(harness.redirects, ['/enquiry-thank-you/']);
  }
});

test('a 2xx response redirects only when the saved-record contract is confirmed', async () => {
  for (const responseBody of [
    { data: { accepted: false, reference: 'STQ-000007' } },
    { data: { accepted: true, reference: null } },
    { accepted: true, reference: 'STQ-000007' },
  ]) {
    const harness = createSubmissionHarness({
      fields: formFields('Request Quote / RFQ'),
      fetchImpl: async () => ({ ok: true, json: async () => responseBody }),
    });
    await harness.submit();
    assert.deepEqual(harness.redirects, []);
    assert.equal(harness.controls.company.value, 'Loom Works');
    assert.equal(harness.button.disabled, false);
    assert.match(harness.status.textContent, /couldn\u2019t submit your enquiry right now/);
  }
});

test('HTTP validation errors and network failures preserve fields and allow retry', async () => {
  for (const fetchImpl of [
    async () => ({ ok: false, json: async () => ({ detail: 'Validation failed' }) }),
    async () => { throw new TypeError('Network unavailable'); },
  ]) {
    const harness = createSubmissionHarness({ fields: formFields('Request Sample'), fetchImpl });
    await harness.submit();
    assert.deepEqual(harness.redirects, []);
    assert.equal(harness.controls.product.value, 'M Type');
    assert.equal(harness.controls.notes.value, 'Gold yarn for weaving');
    assert.equal(harness.form.dataset.apiSubmitting, 'false');
    assert.equal(harness.button.disabled, false);
  }
});

test('a pending submission suppresses duplicate submit events', async () => {
  let resolveFetch;
  const response = new Promise(resolve => { resolveFetch = resolve; });
  const harness = createSubmissionHarness({
    fields: formFields('Homepage Business Enquiry'),
    fetchImpl: async () => response,
  });
  const first = harness.submit();
  await harness.submit();
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.button.disabled, true);
  resolveFetch({ ok: true, json: async () => ({ data: { accepted: true, reference: 'STB-000007' } }) });
  await first;
  assert.deepEqual(harness.redirects, ['/enquiry-thank-you/']);
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
  assert.match(flow, /body\?\.data\?\.accepted === true/);
  assert.match(flow, /\^ST\[QSB\]-\\d\{6,\}\$/);
  assert.match(flow, /if \(!response\.ok \|\| !isAcceptedIntake\(body\)\)/);
  assert.match(flow, /await submitIntake\(payload\);[^]*window\.location\.assign\(THANK_YOU_PATH\)/);
});

const createSubmissionHarness = ({ fields, fetchImpl }) => {
  const button = { disabled: true, textContent: 'Submit', dataset: { submitLabel: 'Submit' } };
  const status = { textContent: '' };
  const controls = Object.fromEntries(Object.keys(fields).map(name => [name, { name, value: fields[name] }]));
  const form = {
    dataset: {},
    elements: controls,
    querySelector(selector) {
      if (selector === '[type=submit]') return button;
      if (selector === '.form-errors') return status;
      return null;
    },
    append(control) { this.elements[control.name] = control; },
    addEventListener(type, listener) {
      if (type === 'submit') this.submitListener = listener;
    },
  };
  const requests = [];
  const redirects = [];
  const location = {
    pathname: '/test-enquiry-client',
    href: 'https://suvarnatantu.com/test-enquiry-client/',
    assign(path) { redirects.push(path); },
  };
  class FakeFormData {
    constructor(target) {
      this.values = Object.values(target.elements).map(control => [control.name, control.value]);
    }
    entries() { return this.values[Symbol.iterator](); }
    [Symbol.iterator]() { return this.entries(); }
  }
  const context = {
    AbortController,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    FormData: FakeFormData,
    Uint8Array,
    clearTimeout,
    console,
    document: {
      createElement: () => ({ type: '', name: '', value: '' }),
      dispatchEvent: () => {},
      querySelector: () => null,
      querySelectorAll: selector => selector === '[data-enquiry-form]' ? [form] : [],
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return fetchImpl(url, options);
    },
    location,
    sessionStorage: { getItem: () => null, setItem: () => {} },
    setTimeout,
    window: {
      SuvarnatantuProducts: {},
      crypto: { randomUUID: () => 'f56fa6d3-8af4-4bfa-8ddb-2b1946bd0711' },
      location,
      addEventListener: () => {},
    },
  };
  vm.runInNewContext(flow, context, { filename: 'assets/js/b2b-flow.js' });
  return {
    button,
    controls,
    form,
    redirects,
    requests,
    status,
    submit: () => form.submitListener({ preventDefault() {} }),
  };
};

const formFields = enquiryType => ({
  enquiry_type: enquiryType,
  source_url: enquiryType.includes('Homepage')
    ? 'https://suvarnatantu.com/'
    : enquiryType.includes('Quote')
      ? 'https://suvarnatantu.com/request-quote/'
      : 'https://suvarnatantu.com/samples/',
  full_name: enquiryType.includes('Homepage') ? 'Mira Shah' : '',
  contact: enquiryType.includes('Homepage') ? '' : 'Mira Shah',
  company: 'Loom Works',
  email: 'mira@example.com',
  phone: '+91 90000 00000',
  product: 'M Type',
  productType: 'Metallic Yarn',
  quantity: '100',
  unit: 'KG',
  notes: 'Gold yarn for weaving',
  honeypot: '',
});

test('definite failures remain on the form and preserve entered values', () => {
  assert.match(flow, /if \(!response\.ok \|\| !isAcceptedIntake\(body\)\)/);
  assert.match(flow, /We couldn\\u2019t submit your enquiry right now\. Please try again or contact us on WhatsApp\./);
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

test('quote and sample phone fields enforce a practical international format', () => {
  assert.match(flow, /phone\.pattern = '\(\?=\.\*\[0-9\]\).*\{7,20\}'/);
  assert.match(flow, /phone\.minLength = 7/);
  assert.match(flow, /phone\.maxLength = 20/);
  assert.match(flow, /Enter a valid phone number using 7 to 20 digits and common phone symbols\./);
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
  assert.match(loader, /b2b-flow\.js\?v=20261001-enquiry-contract/);
  assert.match(quotePage, /b2b-flow\.js\?v=20261001-enquiry-contract/);
});
