import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const page = read('zari-lab/index.html');
const brief = read('assets/js/zari-lab-brief.js');
const reference = read('assets/js/zari-lab-reference.js');
const troubleshooting = read('assets/js/zari-lab-troubleshooting.js');
const styles = read('assets/css/styles.css');

test('Unified Requirement Brief is mounted before the final CTA', () => {
  assert.match(page, /id="requirement-brief"/);
  assert.ok(page.indexOf('id="requirement-brief"') < page.indexOf('zlh-final-cta'));
  assert.match(page, /ZARI LAB REQUIREMENT BRIEF/);
  assert.match(page, /Your Requirement Brief/);
  assert.match(page, /Draft &mdash; Technical Review Required/);
  assert.match(page, /not a final, approved or production-ready specification/);
  assert.match(page, /zari-lab-brief\.js/);
});

test('Brief is reachable from all required workflow areas', () => {
  assert.match(page, /zlh-troubleshooting-summary__actions[\s\S]*href="#requirement-brief"/);
  assert.match(page, /zlh-reference-brief-link" href="#requirement-brief"/);
  assert.match(page, /zlh-final-cta[\s\S]*href="#requirement-brief"/);
  const configurator = read('assets/js/zari-lab-configurator.js');
  assert.match(configurator, /brief\.href = '#requirement-brief'/);
});

test('Aggregation reads all module states without mutating core state', () => {
  for (const event of [
    'suvarnatantu:zari-requirement-query', 'suvarnatantu:zari-colour-lab-state-query',
    'suvarnatantu:zari-twist-lab-state-query', 'suvarnatantu:zari-tpm-lab-state-query',
    'suvarnatantu:zari-denier-lab-state-query', 'suvarnatantu:zari-construction-lab-state-query',
    'suvarnatantu:zari-reference-query', 'suvarnatantu:zari-troubleshooting-query'
  ]) assert.ok(brief.includes(event), event);
  assert.doesNotMatch(brief, /sessionStorage\.(?:setItem|removeItem)/);
  assert.doesNotMatch(brief, /zari-(?:colour|twist|tpm|denier|construction)-apply/);
  assert.doesNotMatch(brief, /density-slider|fineness-slider|construction-view|comparison-mode|CSSStyle/);
});

test('Build Your Zari precedence and explicit conflict handling are encoded', () => {
  assert.match(brief, /field\('Colour', config\.colour[\s\S]*field\('Colour', colourLab\.colour/);
  assert.match(brief, /configuredKnown === 'yes'[\s\S]*configuredKnown === 'no'[\s\S]*labKnown === 'yes'/);
  assert.match(brief, /Build Your Zari remains the source of truth/);
  assert.doesNotMatch(brief, /choose (?:the )?(?:highest|lowest)|better technical value/i);
});

test('Known, review-required, empty, and refresh states are supported', () => {
  assert.match(brief, /Buyer-provided/);
  assert.match(brief, /Not yet confirmed/);
  assert.match(page, /Items Requiring Technical Review/);
  assert.match(page, /No Zari Lab requirement has been prepared yet/);
  assert.match(page, /data-print-brief disabled/);
  assert.match(page, /data-refresh-brief>Refresh Brief/);
  assert.match(brief, /printButton\.disabled = !brief\.meaningful/);
});

test('Reference query exposes safe local metadata but no binary content or buyer contact', () => {
  assert.match(reference, /files: selectedFiles\.map/);
  for (const property of ['name: file.name', 'size: file.size', "type: file.type || 'Not provided'"]) {
    assert.ok(reference.includes(property), property);
  }
  assert.match(page, /Selected reference files remain on this device and have not been submitted/);
  assert.doesNotMatch(brief, /fullName|company|email|phone|website/);
  assert.doesNotMatch(brief, /FileReader|arrayBuffer|dataURL/);
});

test('Troubleshooting exposes a read-only context query', () => {
  assert.match(troubleshooting, /suvarnatantu:zari-troubleshooting-query/);
  assert.match(troubleshooting, /knownFields: \[\.\.\.state\.data\.knownFields\]/);
  assert.doesNotMatch(brief, /diagnosis|root cause|predicted solution|recommendation/i);
});

test('Native print is used with dedicated professional print styling', () => {
  assert.match(brief, /window\.print\(\)/);
  assert.match(brief, /requestAnimationFrame\(\(\) => requestAnimationFrame/);
  assert.doesNotMatch(brief, /addEventListener\('beforeprint',[^\n]*render/);
  assert.doesNotMatch(brief, /jsPDF|html2pdf|PDFKit|canvas|fetch\(/);
  assert.match(styles, /@media print\{/);
  assert.match(styles, /@page\{size:A4 portrait;margin:12mm\}/);
  assert.match(styles, /main>\*:not\(#requirement-brief\)[^}]*display:none!important/);
  assert.match(styles, /html,body[^}]*overflow:visible!important/);
  assert.match(styles, /\.zlh-requirement-brief__actions[^{]*\{display:none!important\}/);
  assert.match(styles, /\.zlh-brief-document__footer[^{]*\{[^}]*background:#fff!important/);
  assert.match(styles, /break-inside:avoid!important/);
  assert.match(styles, /page-break-inside:avoid!important/);
  assert.match(page, /Suvarnatantu by Vastranand Pvt\. Ltd\./);
  assert.match(page, /suvarnatantu\.com/);
});

test('Brief rendering is safe and uses no unsafe HTML insertion', () => {
  assert.doesNotMatch(brief, /innerHTML|insertAdjacentHTML|outerHTML|document\.write/);
  assert.match(brief, /value\.textContent = item\.value/);
  assert.match(brief, /name\.textContent = file\.name/);
});
