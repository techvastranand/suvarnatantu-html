import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const flow = readFileSync(new URL('../assets/js/b2b-flow.js', import.meta.url), 'utf8');
const loader = readFileSync(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
const homepage = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('all three enquiry types map to the public intake API', () => {
  assert.match(flow, /https:\/\/vastranand\.com\/v1\/public\/suvarnatantu-enquiries/);
  assert.match(flow, /includes\('Homepage'\) \? 'business'/);
  assert.match(flow, /includes\('Quote'\) \? 'quote' : 'sample'/);
  assert.match(flow, /name: fields\.full_name \|\| fields\.contact/);
  assert.match(flow, /product: fields\.product/);
  assert.match(flow, /category: fields\.productType/);
});

test('one retained UUID is reused for an ambiguous timeout retry', () => {
  assert.match(flow, /window\.crypto\?\.randomUUID/);
  assert.match(flow, /form\.dataset\.submissionUuid = newSubmissionUuid\(\)/);
  assert.match(flow, /field\.name = 'submission_uuid'/);
  assert.match(flow, /error\?\.name !== 'AbortError'/);
  assert.match(flow, /return postIntake\(payload\)/);
  assert.doesNotMatch(flow, /catch[^]*newSubmissionUuid\(\)/);
});

test('FormSubmit action, email recipient and thank-you flow remain authoritative after API success', () => {
  assert.match(flow, /https:\/\/formsubmit\.co\/suvarnatantu@gmail\.com/);
  assert.match(flow, /https:\/\/suvarnatantu\.com\/enquiry-thank-you\//);
  assert.match(flow, /await submitIntake\(payload\)/);
  assert.match(flow, /HTMLFormElement\.prototype\.submit\.call\(form\)/);
  assert.match(homepage, /action="https:\/\/formsubmit\.co\/suvarnatantu@gmail\.com"/);
  assert.match(homepage, /name="_next" value="https:\/\/suvarnatantu\.com\/enquiry-thank-you\/"/);
});

test('definite failures retain the form and WhatsApp alternative', () => {
  assert.match(flow, /if \(!response\.ok\)/);
  assert.match(flow, /form\.dataset\.apiSubmitting = 'false'/);
  assert.match(flow, /your details are still here/);
  assert.match(flow, /continue on WhatsApp/);
});

test('quote and sample forms retain the existing product configurator prefill', () => {
  assert.match(flow, /sessionStorage\.setItem\('suvarnatantuB2BConfig'/);
  assert.match(flow, /sessionStorage\.getItem\('suvarnatantuB2BConfig'/);
  assert.match(flow, /Object\.entries\(stored\)\.forEach/);
});

test('the synchronized loader cache-busts only the updated form flow', () => {
  assert.match(loader, /b2b-flow\.js\?v=20260829-1/);
});
