import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join, normalize, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png' };
const server = createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const requested = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const file = normalize(join(projectRoot, requested.replace(/^\/+/, '')));
    if (relative(projectRoot, file).startsWith('..') || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(readFileSync(file));
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});

const listen = () => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const waitFor = async (callback, message, attempts = 80) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await callback();
      if (value) return value;
    } catch { /* Retry while the browser or page initializes. */ }
    await delay(100);
  }
  throw new Error(message);
};

await listen();
const address = server.address();
const pageUrl = `http://127.0.0.1:${address.port}/zari-lab/`;
const debugPort = 9327;
const browserPaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const browserPath = browserPaths.find(existsSync);
assert.ok(browserPath, 'Chrome or Edge is required for browser validation.');
const profile = mkdtempSync(join(tmpdir(), 'suvarnatantu-zari-lab-'));
const browser = spawn(browserPath, [
  '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore', windowsHide: true });

let socket;
try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok, 'Browser debugging endpoint did not start.');
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(pageUrl)}`, { method: 'PUT' });
  const target = await targetResponse.json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let commandId = 0;
  const pending = new Map();
  const consoleErrors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params.exceptionDetails.text || 'Runtime exception');
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map(argument => argument.value || argument.description || '').join(' '));
    }
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const ready = () => waitFor(() => evaluate(`document.querySelector('[data-troubleshooting-lab]')?.dataset.troubleshootingReady === 'true' && document.querySelector('[data-requirement-brief]')?.dataset.briefReady === 'true'`), 'Zari Lab workflows did not initialize.');
  const choose = (name, value) => evaluate(`(() => {
    const control = Array.from(document.querySelectorAll('[name="${name}"]')).find(item => item.value === ${JSON.stringify(value)});
    if (!control) return false;
    control.click();
    return control.checked;
  })()`);
  const submit = () => evaluate(`(() => { document.querySelector('[data-troubleshooting-form]').requestSubmit(); return true; })()`);

  await command('Runtime.enable');
  await command('Page.enable');
  await command('Log.enable');
  await ready();

  const pressKey = async (key, code, virtualKeyCode) => {
    const params = { key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode };
    await command('Input.dispatchKeyEvent', { ...params, type: 'keyDown' });
    await command('Input.dispatchKeyEvent', { ...params, type: 'keyUp' });
  };

  // Keyboard E2E: section links follow DOM order and native activation reaches the target.
  await evaluate(`document.querySelector('.zlh-section-nav a').focus()`);
  await pressKey('Tab', 'Tab', 9);
  assert.equal(await evaluate(`document.activeElement.textContent.trim()`), 'Colour');
  await pressKey('Enter', 'Enter', 13);
  assert.equal(await evaluate(`location.hash`), '#colour-finish-lab');

  // Native Space activation works for interactive lab controls.
  await evaluate(`document.querySelector('[data-twist="S Twist"]').focus()`);
  await pressKey(' ', 'Space', 32);
  assert.equal(await evaluate(`document.querySelector('[data-twist="S Twist"]').getAttribute('aria-pressed')`), 'true');

  // Unified Brief Scenario F: a fresh session shows an empty state and cannot print an empty document.
  const emptyBrief = await evaluate(`(() => ({
    emptyVisible: !document.querySelector('[data-brief-empty]').hidden,
    documentHidden: document.querySelector('[data-brief-document]').hidden,
    printDisabled: document.querySelector('[data-print-brief]').disabled,
    startHref: document.querySelector('[data-brief-empty] a').getAttribute('href')
  }))()`);
  assert.deepEqual(emptyBrief, { emptyVisible: true, documentHidden: true, printDisabled: true, startHref: '#build-your-zari' });
  await command('Emulation.setEmulatedMedia', { media: 'print' });
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-brief-document]')).display`), 'none');
  await command('Emulation.setEmulatedMedia', { media: 'screen' });

  for (const width of [360, 390, 768, 1024, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    const layout = await evaluate(`(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      panelWidth: Math.round(document.querySelector('.zlh-troubleshooting__workspace').getBoundingClientRect().width),
      viewport: document.documentElement.clientWidth,
      navClient: document.querySelector('.zlh-section-nav .wrap').clientWidth,
      navScroll: document.querySelector('.zlh-section-nav .wrap').scrollWidth
    }))()`);
    assert.equal(layout.overflow, false, `Horizontal overflow at ${width}px.`);
    assert.ok(layout.panelWidth <= layout.viewport, `Troubleshooting panel exceeds viewport at ${width}px.`);
    if (width <= 390) assert.ok(layout.navScroll > layout.navClient, `Section navigation should scroll horizontally at ${width}px.`);
  }

  await command('Emulation.setDeviceMetricsOverride', { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });

  // Explicit Lab values populate requirement fields when Build Your Zari has no value.
  const labFallback = await evaluate(`(() => {
    document.querySelector('[data-colour-options] [data-colour="Gold"]').click();
    document.querySelector('[data-finish-options] [data-finish="Soft Metallic"]').click();
    document.querySelector('[data-twist-options] [data-twist="Z Twist"]').click();
    document.querySelector('[data-tpm-known="yes"]').click();
    const tpm = document.querySelector('[data-tpm-input]'); tpm.value = '2500'; tpm.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-denier-known="yes"]').click();
    const denier = document.querySelector('[data-denier-input]'); denier.value = '100'; denier.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-construction-known="yes"]').click();
    const construction = document.querySelector('[data-construction-input]'); construction.value = 'Lab-only buyer construction'; construction.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-refresh-brief]').click();
    return Object.fromEntries(Array.from(document.querySelectorAll('.zlh-brief-section dl>div')).map(row => [row.querySelector('dt').textContent, {
      value: row.querySelector('dd strong').textContent,
      source: row.querySelector('.zlh-brief-source').textContent
    }]));
  })()`);
  assert.deepEqual(labFallback.Colour, { value: 'Gold', source: 'From Colour Lab' });
  assert.deepEqual(labFallback.Finish, { value: 'Soft Metallic', source: 'From Colour Lab' });
  assert.deepEqual(labFallback.Twist, { value: 'Z Twist', source: 'From Twist Lab' });
  assert.deepEqual(labFallback.TPM, { value: '2500', source: 'From TPM Explorer' });
  assert.deepEqual(labFallback.Denier, { value: '100', source: 'From Denier Explorer' });
  assert.deepEqual(labFallback.Construction, { value: 'Lab-only buyer construction', source: 'From Construction Explorer' });

  // Exercise the existing 8-step configurator before using it as a read-only source.
  const configuratorResult = await evaluate(`(() => {
    const root = document.querySelector('[data-zari-configurator]');
    const form = root.querySelector('[data-configurator-form]');
    const pick = (name, value) => Array.from(root.querySelectorAll('[name="' + name + '"]')).find(control => control.value === value)?.click();
    const next = () => form.requestSubmit();
    pick('application', 'Saree'); next();
    pick('yarnType', 'MX Type'); next();
    pick('colour', 'Gold'); pick('finish', 'Bright'); next();
    pick('denierKnown', 'yes');
    const denier = root.querySelector('[name="denier"]'); denier.value = '120'; denier.dispatchEvent(new Event('input', { bubbles: true })); next();
    pick('tpmKnown', 'yes');
    const tpm = root.querySelector('[name="tpm"]'); tpm.value = '3200'; tpm.dispatchEvent(new Event('input', { bubbles: true })); next();
    pick('twist', 'S Twist'); next();
    pick('constructionKnown', 'yes');
    const construction = root.querySelector('[name="construction"]'); construction.value = 'MX 120D metallic construction'; construction.dispatchEvent(new Event('input', { bubbles: true })); next();
    pick('requirementStage', 'Sample / Development'); pick('reference', 'Specification sheet');
    const quantity = root.querySelector('[name="quantity"]'); quantity.value = '100 kg'; quantity.dispatchEvent(new Event('input', { bubbles: true })); next();
    let data = null;
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-requirement-query', { detail: { respond: value => { data = value; } } }));
    return { navCount: root.querySelectorAll('[data-step-nav] li').length, summaryVisible: !root.querySelector('[data-summary]').hidden, data };
  })()`);
  assert.equal(configuratorResult.navCount, 8);
  assert.equal(configuratorResult.summaryVisible, true);
  assert.equal(configuratorResult.data.tpm, '3200');
  assert.equal(configuratorResult.data.construction, 'MX 120D metallic construction');

  // Exercise existing lab controls and confirm only explicit requirement state is exposed.
  const labStates = await evaluate(`(() => {
    document.querySelector('[data-colour-options] [data-colour="Gold"]').click();
    document.querySelector('[data-finish-options] [data-finish="Soft Metallic"]').click();
    document.querySelector('[data-twist-options] [data-twist="Z Twist"]').click();
    document.querySelector('[data-tpm-known="yes"]').click();
    const tpm = document.querySelector('[data-tpm-input]'); tpm.value = '2750'; tpm.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-denier-known="yes"]').click();
    const denier = document.querySelector('[data-denier-input]'); denier.value = '120'; denier.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-construction-known="yes"]').click();
    const construction = document.querySelector('[data-construction-input]'); construction.value = 'Buyer supplied construction'; construction.dispatchEvent(new Event('input', { bubbles: true }));
    const read = name => { let result = null; document.dispatchEvent(new CustomEvent(name, { detail: { respond: value => { result = value; } } })); return result; };
    return {
      colour: read('suvarnatantu:zari-colour-lab-state-query'), twist: read('suvarnatantu:zari-twist-lab-state-query'),
      tpm: read('suvarnatantu:zari-tpm-lab-state-query'), denier: read('suvarnatantu:zari-denier-lab-state-query'),
      construction: read('suvarnatantu:zari-construction-lab-state-query')
    };
  })()`);
  assert.deepEqual(labStates.colour, { colour: 'Gold', finish: 'Soft Metallic', note: '' });
  assert.equal(labStates.twist.twist, 'Z Twist');
  assert.equal(labStates.tpm.tpm, '2750');
  assert.equal(labStates.denier.denier, '120');
  assert.equal(labStates.construction.construction, 'Buyer supplied construction');

  // Unified Brief Scenario A/C: configurator values win and explicit Lab differences are disclosed.
  await evaluate(`document.querySelector('[data-refresh-brief]').click()`);
  const precedenceBrief = await evaluate(`(() => {
    const rows = Object.fromEntries(Array.from(document.querySelectorAll('.zlh-brief-section dl>div')).map(row => [row.querySelector('dt').textContent, row.querySelector('dd strong').textContent]));
    return {
      rows,
      conflictText: document.querySelector('[data-brief-conflicts]').textContent,
      conflictVisible: !document.querySelector('[data-brief-conflicts]').hidden,
      printDisabled: document.querySelector('[data-print-brief]').disabled
    };
  })()`);
  assert.equal(precedenceBrief.rows.Finish, 'Bright');
  assert.equal(precedenceBrief.rows.Twist, 'S Twist');
  assert.equal(precedenceBrief.rows.TPM, '3200');
  assert.equal(precedenceBrief.rows.Denier, '120');
  assert.equal(precedenceBrief.rows.Construction, 'MX 120D metallic construction');
  assert.equal(precedenceBrief.conflictVisible, true);
  assert.match(precedenceBrief.conflictText, /Finish/);
  assert.match(precedenceBrief.conflictText, /Twist/);
  assert.match(precedenceBrief.conflictText, /TPM/);
  assert.equal(precedenceBrief.printDisabled, false);

  for (const width of [360, 390, 768, 1024, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    const briefLayout = await evaluate(`(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      documentWidth: Math.round(document.querySelector('[data-brief-document]').getBoundingClientRect().width),
      viewport: document.documentElement.clientWidth
    }))()`);
    assert.equal(briefLayout.overflow, false, `Unified brief horizontal overflow at ${width}px.`);
    assert.ok(briefLayout.documentWidth <= briefLayout.viewport, `Unified brief exceeds viewport at ${width}px.`);
  }
  await command('Emulation.setDeviceMetricsOverride', { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });

  // Exercise Reference Review file selection, query integration, and removal.
  const referenceResult = await evaluate(`(() => {
    const input = document.querySelector('#zlh-reference-files');
    const transfer = new DataTransfer();
    transfer.items.add(new File(['reference'], 'reference.png', { type: 'image/png', lastModified: 1 }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[name="referenceType"][value="Yarn Photo"]').click();
    document.querySelector('[name="physicalSample"][value="Yes"]').click();
    document.querySelector('[data-refresh-brief]').click();
    let before = null;
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-reference-query', { detail: { respond: value => { before = value; } } }));
    return {
      before,
      briefText: document.querySelector('[data-brief-files-section]').textContent,
      filesVisible: !document.querySelector('[data-brief-files-section]').hidden
    };
  })()`);
  assert.equal(referenceResult.before.fileCount, 1);
  assert.equal(referenceResult.filesVisible, true);
  assert.match(referenceResult.briefText, /reference\.png/);
  assert.match(referenceResult.briefText, /image\/png/);
  assert.match(referenceResult.briefText, /9 B/);
  assert.match(referenceResult.briefText, /have not been submitted to Suvarnatantu/);

  // Scenario A: colour concern through a complete brief.
  assert.equal(await choose('category', 'Colour / Appearance'), true);
  await submit();
  assert.equal(await choose('observation', 'Existing sample looks different'), true);
  await submit();
  assert.equal(await choose('desiredResult', 'Match an existing reference'), true);
  await submit();
  await evaluate(`document.querySelector('[data-use-colour]').click()`);
  assert.equal(await evaluate(`document.querySelector('[name="knownColour"]').value`), 'Gold');
  assert.equal(await evaluate(`document.querySelector('[name="knownFinish"]').value`), 'Soft Metallic');
  await submit();
  assert.equal(await choose('reference', 'Fabric Photo'), true);
  await submit();
  const colourBrief = await evaluate(`(() => ({
    visible: !document.querySelector('[data-troubleshooting-summary]').hidden,
    text: document.querySelector('[data-troubleshooting-summary]').textContent,
    stored: JSON.parse(sessionStorage.getItem('suvarnatantu_zari_lab_troubleshooting'))
  }))()`);
  assert.equal(colourBrief.visible, true);
  assert.match(colourBrief.text, /Colour \/ Appearance/);
  assert.match(colourBrief.text, /Existing sample looks different/);
  assert.match(colourBrief.text, /Gold \/ Soft Metallic/);
  assert.match(colourBrief.text, /Fabric Photo/);
  assert.doesNotMatch(colourBrief.text, /Diagnosis|Root Cause Identified|Technical Conclusion/);
  assert.equal(colourBrief.stored.view, 'summary');

  // Unified Brief Scenario E/G: troubleshooting context appears and Refresh re-reads changed TPM.
  await evaluate(`document.querySelector('[data-refresh-brief]').click()`);
  const unifiedContext = await evaluate(`(() => ({
    text: document.querySelector('[data-brief-document]').textContent,
    editHrefs: Array.from(document.querySelectorAll('.zlh-brief-edit'), link => link.getAttribute('href')),
    prepared: document.querySelector('[data-brief-prepared]').textContent
  }))()`);
  assert.match(unifiedContext.text, /Colour \/ Appearance/);
  assert.match(unifiedContext.text, /Existing sample looks different/);
  assert.match(unifiedContext.text, /Match an existing reference/);
  assert.match(unifiedContext.prepared, /^Prepared:/);
  for (const href of ['#build-your-zari', '#colour-finish-lab', '#twist-lab', '#tpm-explorer', '#denier-explorer', '#construction-explorer', '#reference-review', '#troubleshooting-lab']) {
    assert.ok(unifiedContext.editHrefs.includes(href), `Missing edit link ${href}.`);
  }
  await evaluate(`document.dispatchEvent(new CustomEvent('suvarnatantu:zari-tpm-apply', { detail: { tpmKnown: 'yes', tpm: '4100' } })); document.querySelector('[data-refresh-brief]').click()`);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.zlh-brief-section dl>div')).find(row => row.querySelector('dt').textContent === 'TPM').querySelector('dd strong').textContent`), '4100');

  // Native Print / Save as PDF action and Chromium print layout.
  assert.equal(await evaluate(`(() => { window.__briefPrintCalled = false; window.print = () => { window.__briefPrintCalled = true; }; document.querySelector('[data-print-brief]').click(); return window.__briefPrintCalled; })()`), true);
  await command('Emulation.setEmulatedMedia', { media: 'print' });
  const printLayout = await evaluate(`(() => ({
    headerHidden: getComputedStyle(document.querySelector('#site-header-mount')).display === 'none',
    otherSectionHidden: getComputedStyle(document.querySelector('main > section:not(#requirement-brief)')).display === 'none',
    controlsHidden: getComputedStyle(document.querySelector('.zlh-requirement-brief__actions')).display === 'none',
    documentVisible: getComputedStyle(document.querySelector('[data-brief-document]')).display !== 'none',
    disclaimerVisible: getComputedStyle(document.querySelector('.zlh-brief-document__disclaimer')).display !== 'none',
    footerText: document.querySelector('.zlh-brief-document__footer').textContent,
    overflow: document.querySelector('[data-brief-document]').scrollWidth > document.querySelector('[data-brief-document]').clientWidth
  }))()`);
  assert.equal(printLayout.headerHidden, true);
  assert.equal(printLayout.otherSectionHidden, true);
  assert.equal(printLayout.controlsHidden, true);
  assert.equal(printLayout.documentVisible, true);
  assert.equal(printLayout.disclaimerVisible, true);
  assert.match(printLayout.footerText, /Suvarnatantu by Vastranand Pvt\. Ltd\./);
  assert.match(printLayout.footerText, /suvarnatantu\.com/);
  assert.equal(printLayout.overflow, false);
  const pdf = await command('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
  assert.ok(Buffer.from(pdf.data, 'base64').length > 10000, 'Printed brief PDF is unexpectedly small.');
  await command('Emulation.setEmulatedMedia', { media: 'screen' });

  // Removing a Reference Review file removes it from the unified brief immediately.
  await evaluate(`document.querySelector('[data-file-list] button').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-brief-files-section]').hidden`), true);

  // State restoration keeps the completed brief on-page.
  await command('Page.reload', { ignoreCache: true });
  await ready();
  assert.equal(await evaluate(`!document.querySelector('[data-troubleshooting-summary]').hidden`), true);

  // Start Again clears only the troubleshooting draft, preserving configurator state.
  const buildDraft = {
    version: 1, currentStep: 4, highestStep: 4, view: 'steps',
    data: {
      application: 'Saree', applicationOther: '', yarnType: 'MX Type', colour: 'Gold', finish: 'Soft Metallic', colourCustom: '',
      denierKnown: 'no', denier: '', tpmKnown: 'yes', tpm: '3200', twist: 'S Twist', constructionKnown: 'no', construction: '',
      constructionNotes: '', requirementStage: 'Production Requirement', quantity: '100 kg', reference: 'Specification sheet', notes: ''
    }
  };
  await evaluate(`sessionStorage.setItem('suvarnatantu_zari_lab_draft', ${JSON.stringify(JSON.stringify(buildDraft))})`);
  await evaluate(`document.querySelector('[data-reset-troubleshooting]').click()`);
  await evaluate(`document.querySelector('[data-troubleshooting-reset-confirm]').click()`);
  const resetState = await evaluate(`(() => ({
    troubleshooting: JSON.parse(sessionStorage.getItem('suvarnatantu_zari_lab_troubleshooting')),
    configurator: JSON.parse(sessionStorage.getItem('suvarnatantu_zari_lab_draft'))
  }))()`);
  assert.equal(resetState.troubleshooting.data.category, '');
  assert.equal(resetState.configurator.data.tpm, '3200');

  // Scenario B/E: import actual Build Your Zari TPM and ignore the visual slider.
  await command('Page.reload', { ignoreCache: true });
  await ready();
  await choose('category', 'TPM Concern'); await submit();
  await choose('observation', 'Known TPM needs review'); await submit();
  await choose('desiredResult', 'Review TPM'); await submit();
  await evaluate(`(() => {
    document.querySelector('[data-tpm-known="yes"]').click();
    const input = document.querySelector('[data-tpm-input]'); input.value = '2750'; input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-density-slider]').value = '5';
  })()`);
  assert.equal(await evaluate(`document.querySelector('[data-use-configurator]').disabled`), false);
  await evaluate(`document.querySelector('[data-use-configurator]').click()`);
  assert.equal(await evaluate(`document.querySelector('[name="knownTpm"]').value`), '3200');
  await evaluate(`document.querySelector('[data-use-tpm]').click()`);
  assert.equal(await evaluate(`document.querySelector('[name="knownTpm"]').value`), '2750');
  assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('suvarnatantu_zari_lab_draft')).data.tpm`), '3200');

  // Relevant read-only buttons reuse explicit Twist, Denier, and Construction requirements.
  await evaluate(`sessionStorage.removeItem('suvarnatantu_zari_lab_troubleshooting')`);
  await command('Page.reload', { ignoreCache: true }); await ready();
  await evaluate(`document.querySelector('[data-twist-options] [data-twist="S Twist"]').click()`);
  await choose('category', 'Twist Concern'); await submit();
  await choose('observation', 'Twist direction uncertain'); await submit();
  await choose('desiredResult', 'Review twist direction'); await submit();
  await evaluate(`document.querySelector('[data-use-twist]').click()`);
  assert.equal(await evaluate(`document.querySelector('[name="knownTwist"]:checked').value`), 'S Twist');

  await evaluate(`sessionStorage.removeItem('suvarnatantu_zari_lab_troubleshooting')`);
  await command('Page.reload', { ignoreCache: true }); await ready();
  await evaluate(`(() => { document.querySelector('[data-denier-known="yes"]').click(); const input = document.querySelector('[data-denier-input]'); input.value = '120'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await choose('category', 'Denier Concern'); await submit();
  await choose('observation', 'Known denier needs review'); await submit();
  await choose('desiredResult', 'Review denier'); await submit();
  await evaluate(`document.querySelector('[data-use-denier]').click()`);
  assert.equal(await evaluate(`document.querySelector('[name="knownDenier"]').value`), '120');

  await evaluate(`sessionStorage.removeItem('suvarnatantu_zari_lab_troubleshooting')`);
  await command('Page.reload', { ignoreCache: true }); await ready();
  await evaluate(`(() => { document.querySelector('[data-construction-known="yes"]').click(); const input = document.querySelector('[data-construction-input]'); input.value = 'Buyer supplied construction'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await choose('category', 'Construction Concern'); await submit();
  await choose('observation', 'Existing construction needs review'); await submit();
  await choose('desiredResult', 'Review yarn construction'); await submit();
  await evaluate(`document.querySelector('[data-use-construction]').click()`);
  assert.equal(await evaluate(`document.querySelector('[name="knownConstruction"]').value`), 'Buyer supplied construction');

  // Scenario D: physical sample context is retained without an exact-match promise.
  await evaluate(`sessionStorage.removeItem('suvarnatantu_zari_lab_troubleshooting')`);
  await command('Page.reload', { ignoreCache: true }); await ready();
  await choose('category', 'Existing Sample Matching'); await submit();
  await choose('observation', 'Yarn sample looks different'); await submit();
  await choose('desiredResult', 'Match an existing reference'); await submit();
  await choose('knownField', 'none'); await submit();
  await choose('reference', 'Physical Yarn Sample'); await submit();
  const sampleBrief = await evaluate(`document.querySelector('[data-troubleshooting-summary]').textContent`);
  assert.match(sampleBrief, /Physical Yarn Sample/);
  assert.doesNotMatch(sampleBrief, /exact match|guaranteed match/i);

  // Scenario C: an unknown issue can proceed without a forced technical value.
  await evaluate(`sessionStorage.removeItem('suvarnatantu_zari_lab_troubleshooting')`);
  await command('Page.reload', { ignoreCache: true });
  await ready();
  await choose('category', 'Not Sure'); await submit();
  await choose('observation', 'Requirement is difficult to describe'); await submit();
  await choose('desiredResult', 'Not Sure'); await submit();
  await choose('knownField', 'none'); await submit();
  await choose('reference', 'Not Sure'); await submit();
  const unknownBrief = await evaluate(`document.querySelector('[data-troubleshooting-summary]').textContent`);
  assert.match(unknownBrief, /Technical Review Required/);
  assert.doesNotMatch(unknownBrief, /Diagnosis|Root Cause/);

  // Unified Brief Scenario B: mostly unknown requirements produce a factual review checklist.
  await evaluate(`sessionStorage.removeItem('suvarnatantu_zari_lab_draft')`);
  await command('Page.reload', { ignoreCache: true });
  await ready();
  await evaluate(`(() => {
    const root = document.querySelector('[data-zari-configurator]');
    const form = root.querySelector('[data-configurator-form]');
    const pick = (name, matcher) => Array.from(root.querySelectorAll('[name="' + name + '"]')).find(control => typeof matcher === 'string' ? control.value === matcher : matcher.test(control.value))?.click();
    const next = () => form.requestSubmit();
    pick('application', 'Saree'); next();
    pick('yarnType', /Not Sure/); next();
    pick('colour', 'Gold'); pick('finish', 'Not Sure'); next();
    pick('denierKnown', 'no'); next();
    pick('tpmKnown', 'no'); next();
    pick('twist', 'Not Sure'); next();
    pick('constructionKnown', 'no'); next();
    pick('requirementStage', 'Not Sure'); pick('reference', 'No reference'); next();
    document.querySelector('[data-refresh-brief]').click();
  })()`);
  const reviewRequiredBrief = await evaluate(`(() => ({
    list: document.querySelector('[data-brief-review-list]').textContent,
    visible: !document.querySelector('[data-brief-review-panel]').hidden,
    text: document.querySelector('[data-brief-document]').textContent
  }))()`);
  assert.equal(reviewRequiredBrief.visible, true);
  for (const label of ['Yarn Type', 'Denier', 'TPM', 'Twist', 'Construction']) assert.match(reviewRequiredBrief.list, new RegExp(label));
  assert.doesNotMatch(reviewRequiredBrief.text, /recommendation|approved specification|production-ready specification approved/i);

  assert.deepEqual(consoleErrors, [], `Browser console errors: ${consoleErrors.join(' | ')}`);
  console.log('Zari Lab troubleshooting, unified brief, responsive, and print scenarios passed.');
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  browser.kill();
  if (browser.exitCode === null) await Promise.race([once(browser, 'exit'), delay(3000)]);
  await new Promise(resolve => server.close(resolve));
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* Browser cleanup can finish after process exit on Windows. */ }
}
