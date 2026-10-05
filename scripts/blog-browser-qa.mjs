import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {extname,resolve,sep} from 'node:path';
import {chromium} from 'playwright-core';

const root=resolve(import.meta.dirname,'..');
const chromeCandidates=[
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
let executablePath;
for(const candidate of chromeCandidates){
  try{await stat(candidate);executablePath=candidate;break;}catch{}
}
if(!executablePath)throw Error('Chrome or Edge was not found. Set CHROME_PATH to run Blog browser QA.');

const longParagraph='Metallic and zari yarn specifications should be reviewed against the intended textile process, machine setup, appearance, handling, shade and downstream performance. ';
const post={
  title:'A practical guide to specifying metallic yarn for demanding textile applications',
  slug:'practical-metallic-yarn-guide',
  excerpt:'A practical technical guide for comparing yarn construction, twist, denier and application requirements.',
  body_html:`<h2 id="selection">Start with the application</h2><p>${longParagraph.repeat(8)}</p><script>window.bad=true</script><p onclick="window.bad=true">Request a <a href="https://example.com/reference" target="_blank">technical reference</a>.</p><table><tr><th scope="col">Review</th><th scope="col">Why it matters</th></tr><tr><td>Construction</td><td>Machine and appearance compatibility</td></tr></table>`,
  featured_media:{url:'PLACEHOLDER_IMAGE',alt_text:'Gold metallic yarn',width:1200,height:750,content_type:'image/jpeg'},
  featured_image_alt:'Gold metallic yarn prepared for textile production',
  author_name:'Suvarnatantu Technical Team',
  primary_category:{name:'Technical Knowledge',slug:'technical-knowledge'},
  tags:[{name:'Metallic Yarn',slug:'metallic-yarn'},{name:'Sourcing',slug:'sourcing'}],
  published_at:'2026-10-01T08:00:00Z',
  seo_title:'Metallic yarn specification guide',
  seo_description:'Review practical factors for specifying metallic yarn.',
  canonical_url:'',
  og_title:'Metallic yarn specification guide',
  og_description:'Review practical factors for specifying metallic yarn.',
  og_media:null,
  updated_at:'2026-10-02T09:00:00Z',
};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
let origin;
let retryAttempts=0;
const envelope=data=>JSON.stringify({message:'ok',data});
const pageEnvelope=records=>envelope({page:1,limit:20,records_total:records.length,records_filtered:records.length,data:records,content_version:'qa-v1'});
const fixturePost=fixture=>({
  ...post,
  title:fixture==='long'?`${post.title} ? ${'long-title '.repeat(6)}`.trim():post.title,
  body_html:fixture==='long'?post.body_html+longParagraph.repeat(45):post.body_html,
  featured_media:{...post.featured_media,url:fixture==='image'?`${origin}/broken-image.webp`:`${origin}/assets/images/blog/gold-metallic-yarn-texture.jpg`},
});

const server=createServer(async(req,res)=>{
  try{
    const requestUrl=new URL(req.url,origin||'http://127.0.0.1');
    const api=/^\/__api\/([^/]+)\/blogs(?:\/([^/]+))?$/.exec(requestUrl.pathname);
    if(api){
      const [,fixture,slug]=api;
      res.setHeader('Content-Type',mime['.json']);
      if(fixture==='loading'){setTimeout(()=>{if(!res.destroyed)res.end(pageEnvelope([]));},5000);return;}
      if(fixture==='failure'){res.writeHead(503);res.end();return;}
      if(fixture==='retry'&&retryAttempts++===0){res.writeHead(503);res.end();return;}
      if(slug){
        if(slug!=='practical-metallic-yarn-guide'&&slug!=='what-is-metallic-yarn'){res.writeHead(404);res.end();return;}
        res.writeHead(200);res.end(envelope({...fixturePost(fixture),slug}));return;
      }
      const records=fixture==='empty'?[]:fixture==='draft'?[{...fixturePost(fixture),status:'draft'}]:[fixturePost(fixture)];
      res.writeHead(200);res.end(pageEnvelope(records));return;
    }
    if(requestUrl.pathname==='/broken-image.webp'){res.writeHead(404);res.end();return;}
    const pathname=decodeURIComponent(requestUrl.pathname);
    const candidates=pathname.endsWith('/')
      ? [`.${pathname}index.html`,`.${pathname.slice(0,-1)}.html`]
      : extname(pathname)?[`.${pathname}`]:[`.${pathname}/index.html`,`.${pathname}.html`];
    let file;
    let body;
    for(const candidate of candidates){
      const resolved=resolve(root,candidate);
      if(resolved!==root&&!resolved.startsWith(root+sep))continue;
      try{body=await readFile(resolved);file=resolved;break;}catch(error){if(error?.code!=='ENOENT')throw error;}
    }
    if(!file){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  }catch(error){
    res.writeHead(error?.code==='ENOENT'?404:500,{'Content-Type':'text/plain'});
    res.end('Not found');
  }
});
await new Promise((resolveListen,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolveListen);});
origin=`http://127.0.0.1:${server.address().port}`;
const outputDir=await mkdtemp(resolve(tmpdir(),'suvarnatantu-blog-qa-'));
const viewports=[[1440,900],[768,1024],[390,844],[320,568]];
const browser=await chromium.launch({executablePath,headless:true});

async function inspect(path,[width,height],expected,{screenshot}={}){
  const fixture=new URL(path,origin).searchParams.get('fixture')||'empty';
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(apiRoot=>{window.__SUVARNATANTU_BLOG_API_ROOT__=apiRoot;},`${origin}/__api/${fixture}/blogs`);
  const page=await context.newPage();
  const errors=[];
  const requests=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>requests.push(request.url()));
  await page.goto(`${origin}${path}`,{waitUntil:'domcontentloaded'});
  if(expected!=='loading')await page.waitForFunction(state=>document.querySelector('[data-blog-state]:not([hidden])')?.dataset.blogState===state,expected,{timeout:10000});
  const state=await page.locator('[data-blog-state]:not([hidden])').getAttribute('data-blog-state');
  assert.equal(state,expected,`${path} rendered ${state}, expected ${expected}`);
  await page.locator('.site-nav').waitFor({state:'attached'});
  await page.locator('.site-footer').waitFor({state:'attached'});
  if(width<=390){
    const toggle=page.locator('.nav-toggle');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'),'true',`Mobile menu failed at ${path} ${width}x${height}`);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'),'false',`Mobile menu failed to close at ${path} ${width}x${height}`);
  }
  const focusable=page.locator('main a:visible, main button:visible').first();
  await focusable.focus();
  assert.equal(await focusable.evaluate(element=>document.activeElement===element),true,`Keyboard focus failed at ${path}`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,`Horizontal overflow at ${path} ${width}x${height}`);
  assert.equal(requests.some(url=>/ghost\.io|ghost\/api\/content/i.test(url)),false,`Retired provider request at ${path}`);
  const unexpectedErrors=errors.filter(message=>!message.includes('503')&&!message.includes('404'));
  assert.deepEqual(unexpectedErrors,[],`Browser errors at ${path}: ${unexpectedErrors.join(' | ')}`);
  const result={
    state,
    sanitized:await page.locator('[data-detail-content] script,[data-detail-content] [onclick]').count()===0,
    hasArticleHeading:await page.locator('[data-detail-content] h2').count()>0,
    fallback:await page.locator('[data-detail-image]').count()===0||await page.locator('[data-detail-image]').getAttribute('src')==='/assets/images/blog/gold-metallic-yarn-texture.jpg',
  };
  if(screenshot)await page.screenshot({path:screenshot,fullPage:true});
  await context.close();
  return result;
}

const checks=[];
for(const viewport of viewports){
  checks.push([await inspect('/blog/?fixture=valid',viewport,'ready'),'listing valid']);
  checks.push([await inspect('/blog/post/?slug=practical-metallic-yarn-guide&fixture=valid',viewport,'ready'),'detail valid']);
}
checks.push([await inspect('/blog/?fixture=loading',viewports[0],'loading'),'listing loading']);
checks.push([await inspect('/blog/?fixture=empty',viewports[2],'empty'),'listing empty']);
checks.push([await inspect('/blog/?fixture=failure',viewports[1],'unavailable'),'listing failure']);
retryAttempts=0;
{
  const viewport=viewports[2];
  const context=await browser.newContext({viewport:{width:viewport[0],height:viewport[1]}});
  await context.addInitScript(apiRoot=>{window.__SUVARNATANTU_BLOG_API_ROOT__=apiRoot;},`${origin}/__api/retry/blogs`);
  const page=await context.newPage();
  await page.goto(`${origin}/blog/?fixture=retry`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('[data-blog-state]:not([hidden])')?.dataset.blogState==='unavailable');
  await page.locator('[data-blog-retry]').click();
  await page.waitForFunction(()=>document.querySelector('[data-blog-state]:not([hidden])')?.dataset.blogState==='ready');
  checks.push([{state:'ready'},'listing retry']);
  await context.close();
}
checks.push([await inspect('/blog/?fixture=draft',viewports[0],'empty'),'draft filtered']);
checks.push([await inspect('/blog/post/?slug=unknown-post&fixture=valid',viewports[0],'not-found'),'unknown detail']);
checks.push([await inspect('/blog/post/?slug=Bad%20Slug&fixture=valid',viewports[2],'invalid'),'invalid slug']);
checks.push([await inspect('/blog/post/?fixture=valid',viewports[1],'missing'),'missing slug']);
checks.push([await inspect('/blog/post/?slug=practical-metallic-yarn-guide&fixture=image',viewports[0],'ready'),'image fallback']);
checks.push([await inspect('/blog/post/?slug=practical-metallic-yarn-guide&fixture=long',viewports[3],'ready'),'long detail']);
{
  const page=await browser.newPage({viewport:{width:viewports[2][0],height:viewports[2][1]}});
  const requests=[];
  page.on('request',request=>requests.push(request.url()));
  await page.goto(`${origin}/blog/what-is-metallic-yarn/`);
  await page.waitForURL(`${origin}/blog/`);
  assert.equal(requests.some(url=>/ghost\.io|ghost\/api\/content/i.test(url)),false);
  await page.close();
}
for(const [result,label] of checks){
  if(label==='detail valid'){assert.equal(result.hasArticleHeading,true);assert.equal(result.sanitized,true);}
  if(label==='image fallback')assert.equal(result.fallback,true);
}

for(const path of ['/','/products/','/manufacturing/','/samples/','/request-quote/','/enquiry-thank-you/']){
  for(const viewport of [viewports[0],viewports[2]]){
    const context=await browser.newContext({viewport:{width:viewport[0],height:viewport[1]}});
    const page=await context.newPage();
    const errors=[];
    const requests=[];
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>requests.push(request.url()));
    await page.goto(`${origin}${path}`,{waitUntil:'domcontentloaded'});
    await page.locator('.site-nav').waitFor({state:'attached'});
    await page.locator('.site-footer').waitFor({state:'attached'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,`Horizontal overflow at ${path}`);
    assert.equal(requests.some(url=>/ghost\.io|ghost\/api\/content/i.test(url)),false,`Retired provider request at ${path}`);
    assert.deepEqual(errors,[],`Browser errors at ${path}: ${errors.join(' | ')}`);
    await context.close();
  }
}

for(const [name,path,viewport,state] of [
  ['listing-desktop.png','/blog/?fixture=valid',viewports[0],'ready'],
  ['listing-mobile-empty.png','/blog/?fixture=empty',viewports[2],'empty'],
  ['detail-tablet.png','/blog/post/?slug=practical-metallic-yarn-guide&fixture=valid',viewports[1],'ready'],
  ['detail-narrow-long.png','/blog/post/?slug=practical-metallic-yarn-guide&fixture=long',viewports[3],'ready'],
])await inspect(path,viewport,state,{screenshot:resolve(outputDir,name)});

await browser.close();
await new Promise(resolveClose=>server.close(resolveClose));
console.log(JSON.stringify({browser:executablePath,viewports,scenarioChecks:checks.length,regressionPages:6,screenshots:outputDir},null,2));
