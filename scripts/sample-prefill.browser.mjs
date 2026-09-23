import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join, normalize, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png' };
let activeScenario = 'inspect';

const helpers = `
const scenarioErrors=[];
window.addEventListener('error',event=>scenarioErrors.push(event.message||'Window error'));
window.addEventListener('unhandledrejection',event=>scenarioErrors.push(String(event.reason||'Unhandled rejection')));
const finishScenario=value=>{const output=document.createElement('output');output.id='browser-scenario-result';output.dataset.value=encodeURIComponent(JSON.stringify(value));output.dataset.errors=encodeURIComponent(JSON.stringify(scenarioErrors));document.body.append(output)};
const pollScenario=callback=>{let attempts=0;const timer=setInterval(()=>{attempts+=1;try{if(callback())clearInterval(timer)}catch(error){clearInterval(timer);finishScenario({error:String(error)})}if(attempts>240){clearInterval(timer);finishScenario({error:'Timed out'})}},25)};
`;

const inspectScript = `<script>${helpers}
pollScenario(()=>{const form=document.querySelector('form[data-enquiry-form]');if(!form)return false;setTimeout(()=>{const rows=Array.from(document.querySelectorAll('.sample-context-summary>div')).map(row=>[row.querySelector('dt')?.textContent,row.querySelector('dd')?.textContent]);finishScenario({banner:Boolean(document.querySelector('.sample-context-banner')),zariBanner:Boolean(document.querySelector('.zari-handoff-banner')),product:form.elements.product.value,category:form.elements.productType.value,application:form.elements.application.value,colour:form.elements.colour.value,notes:form.elements.notes.value,rows,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bannerWidth:Math.ceil(document.querySelector('.sample-context-banner')?.getBoundingClientRect().width||0),viewport:document.documentElement.clientWidth})},60);return true});
</script>`;

const submissionScript = `<script>${helpers}
let captured=null;window.fetch=async(_url,options)=>{captured=JSON.parse(options.body);return {ok:false,json:async()=>({detail:'Intentional browser-test failure'})}};
pollScenario(()=>{const form=document.querySelector('form[data-enquiry-form]');if(!form)return false;const initial={product:form.elements.product.value,category:form.elements.productType.value,application:form.elements.application.value,colour:form.elements.colour.value,notes:form.elements.notes.value};form.requestSubmit();setTimeout(()=>{const afterInvalid={product:form.elements.product.value,category:form.elements.productType.value,application:form.elements.application.value,colour:form.elements.colour.value,notes:form.elements.notes.value};for(const [name,value] of Object.entries({company:'Test Company',contact:'Test Buyer',email:'buyer@example.com',phone:'9999999999',country:'India',state:'Gujarat',city:'Surat',address:'Test address',postalCode:'394230'}))form.elements[name].value=value;form.elements.consent.checked=true;form.requestSubmit();pollScenario(()=>{if(!captured)return false;setTimeout(()=>finishScenario({initial,afterInvalid,payload:captured.payload,topProduct:captured.product,topCategory:captured.category,stillPresent:{product:form.elements.product.value,application:form.elements.application.value,colour:form.elements.colour.value,notes:form.elements.notes.value}}),60);return true})},60);return true});
</script>`;

const zariScript = `<script>${helpers}
sessionStorage.setItem('suvarnatantu_zari_lab_handoff',JSON.stringify({schemaVersion:1,source:'zari-lab',destinationIntent:'sample',preparedAt:new Date().toISOString(),requirement:{application:'Saree',yarnType:'MX Type',colour:'Gold',finish:'Bright',reviewRequired:[],troubleshooting:{},referenceFiles:[]}}));
pollScenario(()=>{const banner=document.querySelector('.zari-handoff-banner');const form=document.querySelector('form[data-enquiry-form]');if(!banner||!form)return false;const use=Array.from(banner.querySelectorAll('button')).find(button=>button.textContent==='Use Zari Lab Requirement');if(!use)return false;use.click();pollScenario(()=>{if(!banner.classList.contains('is-applied'))return false;finishScenario({zariBanner:true,queryBanner:Boolean(document.querySelector('.sample-context-banner')),product:form.elements.product.value,application:form.elements.application.value,colour:form.elements.colour.value,notes:form.elements.notes.value});return true});return true});
</script>`;

const productsScript = `<script>${helpers}
window.addEventListener('load',()=>setTimeout(()=>{const links=Array.from(document.querySelectorAll('a[href^="/samples/?"]'));const focusable=links.every(link=>{link.focus();return document.activeElement===link});finishScenario({links:links.length,empty:links.filter(link=>!link.textContent.trim()).length,focusable,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,viewport:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth})},80),{once:true});
</script>`;

const server = createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let requested = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const file = normalize(join(projectRoot, requested.replace(/^\/+/, '')));
    if (relative(projectRoot, file).startsWith('..') || !existsSync(file) || !statSync(file).isFile()) { response.writeHead(404).end('Not found'); return; }
    let body = readFileSync(file);
    if (extname(file) === '.html') {
      const injection = pathname === '/products/' ? productsScript : activeScenario === 'submit' ? submissionScript : activeScenario === 'zari' ? zariScript : inspectScript;
      body = Buffer.from(body.toString('utf8').replace('</body>', `${injection}</body>`));
    }
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch (error) { response.writeHead(500).end(String(error)); }
});

const browserPaths = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];
const browserPath = browserPaths.find(existsSync);
assert.ok(browserPath, 'Chrome or Edge is required for browser validation.');
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const run = (scenario, path, width = 1200) => new Promise((resolve, reject) => {
  activeScenario = scenario;
  const profile = mkdtempSync(join(tmpdir(), `suvarnatantu-sample-prefill-${scenario}-`));
  const child = spawn(browserPath, ['--headless=new', '--disable-gpu', '--disable-gpu-sandbox', '--in-process-gpu', '--use-gl=swiftshader', '--use-angle=swiftshader', '--disable-features=Vulkan,SkiaGraphite', '--disable-extensions', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, `--window-size=${width},1000`, '--virtual-time-budget=9000', '--dump-dom', `http://127.0.0.1:${port}${path}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; let errors = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { errors += chunk; });
  const timeout = setTimeout(() => child.kill(), 30000);
  child.once('error', reject);
  child.once('close', code => {
    clearTimeout(timeout);
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* Best effort. */ }
    if (code !== 0) { reject(new Error(`Browser exited ${code}: ${errors.slice(-500)}`)); return; }
    const tag = output.match(/<output id="browser-scenario-result"[^>]*>/)?.[0];
    const value = tag?.match(/data-value="([^"]+)"/)?.[1];
    const errorValue = tag?.match(/data-errors="([^"]+)"/)?.[1];
    if (!value || !errorValue) { reject(new Error(`Scenario ${scenario} did not produce a result.`)); return; }
    const browserErrors = JSON.parse(decodeURIComponent(errorValue.replaceAll('&amp;', '&')));
    if (browserErrors.length) { reject(new Error(`Scenario ${scenario} errors: ${browserErrors.join(' | ')}`)); return; }
    resolve(JSON.parse(decodeURIComponent(value.replaceAll('&amp;', '&'))));
  });
});

try {
  const direct = await run('inspect', '/samples/');
  assert.equal(direct.banner, false); assert.equal(direct.product, ''); assert.equal(direct.category, ''); assert.equal(direct.notes, '');

  for (const [value, expected] of [['metallic-yarn', 'Metallic Yarn'], ['zari-yarn', 'Zari Yarn'], ['colours-finishes', 'Colours & Finishes'], ['filament-yarn', 'Filament Yarn'], ['twisted-yarn', 'Twisted Yarn'], ['specialty-yarn', 'Specialty Yarn']]) {
    const result = await run('inspect', `/samples/?family=${value}`); assert.equal(result.category, expected); assert.equal(result.banner, true);
  }
  for (const [value, expected] of [['m-type', 'M Type'], ['mx-type', 'MX Type'], ['st-type', 'ST Type'], ['mh-type', 'MH Type']]) {
    const result = await run('inspect', `/samples/?product=${value}`); assert.equal(result.product, expected); assert.equal(result.banner, true);
  }

  const application = await run('inspect', '/samples/?application=saree'); assert.equal(application.application, 'Saree Weaving');
  const colour = await run('inspect', '/samples/?colour=gold'); assert.equal(colour.colour, 'Gold');
  const custom = await run('inspect', '/samples/?finish=custom'); assert.equal(custom.notes, 'Finish: Custom');

  for (const invalid of ['/samples/?product=random-invalid-value', '/samples/?product=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', '/samples/?family=constructor']) {
    const result = await run('inspect', invalid); assert.equal(result.banner, false); assert.equal(result.product, ''); assert.equal(result.category, '');
  }

  const multiple = await run('inspect', '/samples/?family=metallic-yarn&product=mx-type&application=saree&colour=gold&finish=bright');
  assert.deepEqual({ category: multiple.category, product: multiple.product, application: multiple.application, colour: multiple.colour, notes: multiple.notes }, { category: 'Metallic Yarn', product: 'MX Type', application: 'Saree Weaving', colour: 'Gold', notes: 'Finish: Bright' });
  assert.deepEqual(multiple.rows, [['Product family', 'Metallic Yarn'], ['Product', 'MX Type'], ['Application', 'Saree Weaving'], ['Colour', 'Gold'], ['Finish', 'Bright']]);

  const submission = await run('submit', '/samples/?family=metallic-yarn&product=mx-type&application=saree&colour=gold&finish=bright');
  assert.deepEqual(submission.initial, submission.afterInvalid);
  assert.equal(submission.payload.product, 'MX Type'); assert.equal(submission.payload.productType, 'Metallic Yarn'); assert.equal(submission.payload.application, 'Saree Weaving'); assert.equal(submission.payload.colour, 'Gold'); assert.equal(submission.payload.notes, 'Finish: Bright');
  assert.equal(submission.topProduct, 'MX Type'); assert.equal(submission.topCategory, 'Metallic Yarn'); assert.deepEqual(submission.stillPresent, { product: 'MX Type', application: 'Saree Weaving', colour: 'Gold', notes: 'Finish: Bright' });

  const zari = await run('zari', '/samples/?product=m-type');
  assert.equal(zari.zariBanner, true); assert.equal(zari.queryBanner, false); assert.equal(zari.product, 'MX Type'); assert.equal(zari.application, 'Saree Weaving'); assert.equal(zari.colour, 'Gold'); assert.match(zari.notes, /Finish: Bright/);

  for (const width of [360, 390, 768, 1024, 1440]) {
    const sample = await run('inspect', '/samples/?family=metallic-yarn&product=m-type&application=saree&colour=gold&finish=bright', width);
    assert.equal(sample.overflow, false, `Sample overflow at ${width}px.`); assert.ok(sample.bannerWidth <= sample.viewport, `Sample banner exceeds ${width}px.`);
    const products = await run('inspect', '/products/', width);
    assert.equal(products.overflow, false, `Products overflow at ${width}px.`); assert.ok(products.links >= 29); assert.equal(products.empty, 0); assert.equal(products.focusable, true);
  }
  console.log('Sample context browser scenarios passed.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
