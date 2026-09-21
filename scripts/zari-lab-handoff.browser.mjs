import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join, normalize, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png' };
const KEY = 'suvarnatantu_zari_lab_handoff';
let activeScenario = '';
const completeRequirement = {
  application: 'Saree', yarnType: 'MX Type', requirementStage: 'Sample / Development', quantity: '100 kg',
  colour: 'Gold', finish: 'Bright', colourNote: '', denier: '120', tpm: '3200', twist: 'S Twist',
  construction: 'MX 120D construction', referenceType: 'Specification sheet', physicalSample: '', existingSpecification: 'Yes',
  reviewRequired: [], troubleshooting: { problemArea: '', observation: '', desiredResult: '' },
  buyerNotes: 'Low-speed loom trial', referenceFiles: []
};
const handoff = (intent, requirement, preparedAt = new Date().toISOString()) => ({ schemaVersion: 1, source: 'zari-lab', destinationIntent: intent, preparedAt, requirement });
const wrapScript = source => `<script>${source.replaceAll('</script>', '<\\/script>')}</script>`;
const helpers = `
const browserScenarioErrors=[];window.addEventListener('error',event=>browserScenarioErrors.push(event.message||'Window error'));window.addEventListener('unhandledrejection',event=>browserScenarioErrors.push(String(event.reason||'Unhandled rejection')));const browserConsoleError=console.error.bind(console);console.error=(...values)=>{browserScenarioErrors.push(values.map(String).join(' '));browserConsoleError(...values)};
const finishBrowserScenario=value=>{const result=document.createElement('output');result.id='browser-scenario-result';result.dataset.value=encodeURIComponent(JSON.stringify(value));result.dataset.errors=encodeURIComponent(JSON.stringify(browserScenarioErrors));document.body.append(result)};
const pollBrowserScenario=callback=>{let attempts=0;const timer=setInterval(()=>{attempts+=1;try{if(callback())clearInterval(timer)}catch(error){clearInterval(timer);finishBrowserScenario({error:String(error)})}if(attempts>200){clearInterval(timer);finishBrowserScenario({error:'Timed out'})}},25)};
`;

const scenarios = {
  source: path => wrapScript(`${helpers}
    if(${JSON.stringify(path)}==='/zari-lab/'){
      sessionStorage.setItem('suvarnatantu_zari_lab_draft',${JSON.stringify(JSON.stringify({
        version: 1, currentStep: 8, highestStep: 8, view: 'summary', data: {
          application: 'Saree', applicationOther: '', yarnType: 'MX Type', colour: 'Gold', finish: 'Bright', colourCustom: '',
          denierKnown: 'yes', denier: '120', tpmKnown: 'yes', tpm: '3200', twist: 'S Twist', constructionKnown: 'yes',
          construction: 'MX 120D construction', constructionNotes: '', requirementStage: 'Sample / Development', quantity: '100 kg',
          reference: 'Specification sheet', notes: 'Low-speed loom trial'
        }
      }))});
      pollBrowserScenario(()=>{const brief=document.querySelector('[data-requirement-brief]');const link=document.querySelector('.zlh-final-cta a[href="/samples/"]');if(brief?.dataset.briefReady!=='true'||!link||document.querySelector('[data-brief-document]').hidden)return false;const input=document.querySelector('#zlh-reference-files');const transfer=new DataTransfer();transfer.items.add(new File(['reference'],'reference.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[name="referenceType"][value="Yarn Photo"]').click();document.querySelector('[name="physicalSample"][value="Yes"]').click();link.click();return true});
    }else if(${JSON.stringify(path)}==='/samples/'){
      pollBrowserScenario(()=>{const banner=document.querySelector('.zari-handoff-banner');const form=document.querySelector('[data-enquiry-form]');if(!banner||!form)return false;const stored=JSON.parse(sessionStorage.getItem(${JSON.stringify(KEY)}));finishBrowserScenario({banner:true,intent:stored.destinationIntent,yarnType:stored.requirement.yarnType,denier:stored.requirement.denier,file:stored.requirement.referenceFiles[0]});return true});
    }
  `),
  sourceRfq: path => scenarios.source(path).replaceAll('/samples/', '/request-quote/'),
  fillEmpty: () => wrapScript(`${helpers}
    sessionStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(JSON.stringify(handoff('sample', completeRequirement)))});let stage=0;
    pollBrowserScenario(()=>{const banner=document.querySelector('.zari-handoff-banner');const form=document.querySelector('[data-enquiry-form]');if(!banner||!form)return false;const button=label=>Array.from(banner.querySelectorAll('button')).find(item=>item.textContent===label||item.textContent.startsWith(label));if(stage===0){button('Review First').click();form.elements.product.value='Existing product';form.elements.notes.value='Manual destination note';form.elements.contact.value='Protected buyer';button('Use This Requirement').click();stage=1;return false}const dialog=banner.querySelector('.zari-handoff-dialog');if(stage===1&&!dialog.hidden){button('Fill Empty Fields Only').click();stage=2;return false}if(stage===2&&banner.classList.contains('is-applied')){finishBrowserScenario({reviewVisible:!banner.querySelector('.zari-handoff-review').hidden,product:form.elements.product.value,notes:form.elements.notes.value,contact:form.elements.contact.value,application:form.elements.application.value,denier:form.elements.denier.value,tpm:form.elements.tpm.value,twist:form.elements.twist.value,quantity:form.elements.quantity.value,unit:form.elements.unit.value,stored:sessionStorage.getItem(${JSON.stringify(KEY)})});return true}return false});
  `),
  reviewSafe: () => wrapScript(`${helpers}
    sessionStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(JSON.stringify(handoff('sample', { yarnType: 'Zari yarn', denier: 'Technical Review Required', quantity: 'Not Sure', reviewRequired: ['Denier', 'Approximate Quantity'] })))});let clicked=false;
    pollBrowserScenario(()=>{const banner=document.querySelector('.zari-handoff-banner');const form=document.querySelector('[data-enquiry-form]');if(!banner||!form)return false;if(!clicked){Array.from(banner.querySelectorAll('button')).find(item=>item.textContent==='Use Zari Lab Requirement').click();clicked=true;return false}if(!banner.classList.contains('is-applied'))return false;finishBrowserScenario({denier:form.elements.denier.value,quantity:form.elements.quantity.value,notes:form.elements.notes.value});return true});
  `),
  replaceRfq: () => wrapScript(`${helpers}
    sessionStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(JSON.stringify(handoff('rfq', {
      application: 'Saree', yarnType: 'Jari Type', requirementStage: 'Sample / Development', quantity: '24 cones', colour: 'Gold', finish: 'Bright', denier: '100', tpm: '2800', twist: 'Z Twist', construction: 'Wrapped metallic yarn', reviewRequired: [], troubleshooting: { problemArea: 'Colour Concern', observation: 'Shade differs', desiredResult: 'Review shade' }, referenceFiles: [{ name: 'buyer-reference.jpg', type: 'image/jpeg', size: 2048 }]
    })))});let stage=0;
    pollBrowserScenario(()=>{const banner=document.querySelector('.zari-handoff-banner');const form=document.querySelector('[data-enquiry-form]');if(!banner||!form)return false;const button=label=>Array.from(banner.querySelectorAll('button')).find(item=>item.textContent===label);if(stage===0){form.elements.product.value='Existing RFQ product';form.elements.contact.value='Protected RFQ buyer';button('Use Zari Lab Requirement').click();stage=1;return false}if(stage===1&&!banner.querySelector('.zari-handoff-dialog').hidden){button('Replace Matching Fields').click();stage=2;return false}if(stage===2&&banner.classList.contains('is-applied')){finishBrowserScenario({product:form.elements.product.value,contact:form.elements.contact.value,category:form.elements.productType.value,requirementType:form.elements.requirementType.value,quantity:form.elements.quantity.value,unit:form.elements.unit.value,notes:form.elements.notes.value,consent:form.elements.consent.checked,stored:sessionStorage.getItem(${JSON.stringify(KEY)})});return true}return false});
  `),
  invalid: () => wrapScript(`${helpers}
    sessionStorage.setItem(${JSON.stringify(KEY)},'{broken');pollBrowserScenario(()=>{const form=document.querySelector('[data-enquiry-form]');if(!form)return false;setTimeout(()=>finishBrowserScenario({banner:Boolean(document.querySelector('.zari-handoff-banner')),stored:sessionStorage.getItem(${JSON.stringify(KEY)}),form:true}),50);return true});
  `),
  responsive: () => wrapScript(`${helpers}
    sessionStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(JSON.stringify(handoff('rfq', { yarnType: 'Responsive yarn', application: 'Saree', reviewRequired: [] })))});pollBrowserScenario(()=>{const banner=document.querySelector('.zari-handoff-banner');if(!banner)return false;finishBrowserScenario({overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,banner:Math.ceil(banner.getBoundingClientRect().width),viewport:document.documentElement.clientWidth});return true});
  `)
};

const server = createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let requested = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    if (requested === '/request-quote/index.html') requested = '/request-quote.html';
    const file = normalize(join(projectRoot, requested.replace(/^\/+/, '')));
    if (relative(projectRoot, file).startsWith('..') || !existsSync(file) || !statSync(file).isFile()) { response.writeHead(404).end('Not found'); return; }
    let body = readFileSync(file);
    if (extname(file) === '.html' && activeScenario && scenarios[activeScenario]) body = Buffer.from(body.toString('utf8').replace('</body>', `${scenarios[activeScenario](pathname)}</body>`));
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' }); response.end(body);
  } catch (error) { response.writeHead(500).end(String(error)); }
});

const browserPaths = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];
const browserPath = browserPaths.find(existsSync);
assert.ok(browserPath, 'Chrome or Edge is required for browser validation.');
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const run = (scenario, path, width = 1200) => new Promise((resolve, reject) => {
  activeScenario = scenario;
  const profile = mkdtempSync(join(tmpdir(), `suvarnatantu-handoff-${scenario}-`));
  const child = spawn(browserPath, ['--headless=new', '--disable-gpu', '--disable-gpu-sandbox', '--in-process-gpu', '--use-gl=swiftshader', '--use-angle=swiftshader', '--disable-features=Vulkan,SkiaGraphite', '--disable-extensions', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, `--window-size=${width},900`, '--virtual-time-budget=8000', '--dump-dom', `http://127.0.0.1:${port}${path}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; let errors = '';
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { errors += chunk; });
  const timeout = setTimeout(() => child.kill(), 30000);
  child.once('error', reject);
  child.once('close', code => {
    clearTimeout(timeout); try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* Best effort. */ }
    if (code !== 0) { reject(new Error(`Browser exited ${code}: ${errors.slice(-500)}`)); return; }
    const tag = output.match(/<output id="browser-scenario-result"[^>]*>/)?.[0];
    const value = tag?.match(/data-value="([^"]+)"/)?.[1];
    const errorsValue = tag?.match(/data-errors="([^"]+)"/)?.[1];
    if (!value || !errorsValue) { reject(new Error(`Scenario ${scenario} did not produce a result.`)); return; }
    const browserErrors = JSON.parse(decodeURIComponent(errorsValue.replaceAll('&amp;', '&')));
    if (browserErrors.length) { reject(new Error(`Scenario ${scenario} browser errors: ${browserErrors.join(' | ')}`)); return; }
    resolve(JSON.parse(decodeURIComponent(value.replaceAll('&amp;', '&'))));
  });
});

try {
  assert.deepEqual(await run('invalid', '/samples/'), { banner: false, stored: null, form: true });
  console.log('Invalid handoff scenario passed.');
  const sourceSample = await run('source', '/zari-lab/');
  assert.equal(sourceSample.banner, true); assert.equal(sourceSample.intent, 'sample'); assert.equal(sourceSample.yarnType, 'MX Type'); assert.equal(sourceSample.denier, '120');
  assert.equal(sourceSample.file.name, 'reference.png'); assert.equal(sourceSample.file.type, 'image/png'); assert.equal(sourceSample.file.size, 9);
  const sourceRfq = await run('sourceRfq', '/zari-lab/');
  assert.equal(sourceRfq.banner, true); assert.equal(sourceRfq.intent, 'rfq'); assert.equal(sourceRfq.yarnType, 'MX Type');
  assert.deepEqual(await run('fillEmpty', '/samples/'), { reviewVisible: true, product: 'Existing product', notes: 'Manual destination note', contact: 'Protected buyer', application: 'Saree Weaving', denier: '120', tpm: '3200', twist: 'S Twist', quantity: '100', unit: 'KG', stored: null });
  const reviewSafe = await run('reviewSafe', '/samples/');
  assert.equal(reviewSafe.denier, ''); assert.equal(reviewSafe.quantity, ''); assert.match(reviewSafe.notes, /Denier: Technical Review Required/); assert.match(reviewSafe.notes, /Technical Review Required: Denier; Approximate Quantity/);
  const rfq = await run('replaceRfq', '/request-quote/');
  assert.equal(rfq.product, 'Jari Type'); assert.equal(rfq.contact, 'Protected RFQ buyer'); assert.equal(rfq.category, ''); assert.equal(rfq.requirementType, 'Development Requirement'); assert.equal(rfq.quantity, '24'); assert.equal(rfq.unit, 'Cone'); assert.equal(rfq.consent, false); assert.equal(rfq.stored, null);
  assert.match(rfq.notes, /buyer-reference\.jpg \(image\/jpeg, 2 KB\)/); assert.match(rfq.notes, /Reference file was selected in Zari Lab but is not attached to this enquiry\./);
  for (const width of [360, 390, 768, 1024, 1440]) { const layout = await run('responsive', '/request-quote/', width); assert.equal(layout.overflow, false, `Horizontal overflow at ${width}px.`); assert.ok(layout.banner <= layout.viewport, `Banner exceeds viewport at ${width}px.`); }
  console.log('Zari Lab Sample/RFQ handoff browser scenarios passed.');
} finally { await new Promise(resolve => server.close(resolve)); }
