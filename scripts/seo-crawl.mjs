// Respectful technical-SEO crawl of a deployed (or locally served) Suvarnatantu site.
// Usage: node scripts/seo-crawl.mjs [baseUrl] [--out report.json] [--render] [--compare baseline.json]
//   baseUrl defaults to https://suvarnatantu.com. Concurrency is capped at 2 requests.
//   --render loads every HTML page in headless Chrome (CHROME_PATH or the default Windows/Linux path)
//   to record client-rendered links and JSON-LD next to the raw HTML values.
//   --compare checks that no URL indexable in the baseline became non-indexable, non-200 or a redirect chain.
import {existsSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const args=process.argv.slice(2);
const flag=name=>{const index=args.indexOf(name);return index<0?null:(args[index+1]||'')};
const base=new URL(args.find(arg=>/^https?:\/\//.test(arg))||'https://suvarnatantu.com');
const origin=base.origin,canonicalOrigin='https://suvarnatantu.com';
const outFile=flag('--out'),compareFile=flag('--compare'),render=args.includes('--render');
const userAgent='VastranandSEOAudit/1.0 (+https://suvarnatantu.com/; technical SEO audit)';
const concurrency=2,maxPages=400;

const sleep=ms=>new Promise(done=>setTimeout(done,ms));
async function request(url,method='GET'){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{method,redirect:'manual',headers:{'user-agent':userAgent,accept:method==='HEAD'?'*/*':'text/html,application/xhtml+xml,*/*'}});
      const body=method==='GET'&&/text|xml|json/.test(response.headers.get('content-type')||'')?await response.text():'';
      if(method==='GET'&&!body)await response.arrayBuffer().catch(()=>null);
      return {status:response.status,location:response.headers.get('location'),headers:Object.fromEntries(response.headers),body};
    }catch(error){if(attempt===2)return {status:0,error:String(error.message||error),headers:{},body:''};await sleep(500*(attempt+1));}
  }
}
async function follow(url,method='GET'){
  const chain=[];let current=url,result;
  for(let hop=0;hop<10;hop++){
    result=await request(current,method);
    chain.push({url:current,status:result.status});
    if(result.status>=300&&result.status<400&&result.location){current=new URL(result.location,current).href;continue;}
    break;
  }
  return {chain,final:result,finalUrl:current};
}
async function pool(items,worker){
  const results=new Array(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(next<items.length){const index=next++;results[index]=await worker(items[index]);await sleep(150);}}));
  return results;
}
const internal=href=>{try{const url=new URL(href);return url.origin===origin||url.origin===canonicalOrigin}catch{return false}};
const toLocal=href=>{const url=new URL(href);return origin+url.pathname+url.search};
const pageKey=href=>{const url=new URL(href);return url.pathname};
const isAsset=path=>/\.(?:css|js|mjs|json|webp|avif|png|jpe?g|gif|svg|ico|pdf|xml|txt|woff2?|ttf|mp4|webm)$/i.test(path);

function analyse(html,url){
  const {document}=parseHTML(html);
  const meta=name=>document.querySelector(`meta[name="${name}"]`)?.getAttribute('content')??null;
  const prop=name=>document.querySelector(`meta[property="${name}"]`)?.getAttribute('content')??null;
  const title=document.querySelector('title')?.textContent.trim()??null;
  const description=meta('description');
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(node=>({level:Number(node.tagName[1]),text:node.textContent.replace(/\s+/g,' ').trim().slice(0,90)}));
  const skips=[];for(let index=1;index<headings.length;index++)if(headings[index].level>headings[index-1].level+1)skips.push(`h${headings[index-1].level}->h${headings[index].level}`);
  const jsonld=[...document.querySelectorAll('script[type="application/ld+json"]')].map(node=>{try{const data=JSON.parse(node.textContent);const items=Array.isArray(data)?data:data['@graph']||[data];return {types:items.map(item=>item['@type']).flat(),data}}catch(error){return {error:String(error.message)}}});
  const images=[...document.querySelectorAll('img')].map(img=>({src:img.getAttribute('src'),alt:img.getAttribute('alt'),width:img.getAttribute('width'),height:img.getAttribute('height'),loading:img.getAttribute('loading'),fetchpriority:img.getAttribute('fetchpriority'),inPicture:img.parentElement?.tagName==='PICTURE'}));
  const links=[...new Set([...document.querySelectorAll('a[href]')].map(anchor=>{try{return new URL(anchor.getAttribute('href'),url).href.split('#')[0]}catch{return null}}).filter(Boolean))];
  const og=Object.fromEntries([...document.querySelectorAll('meta[property^="og:"]')].map(node=>[node.getAttribute('property'),node.getAttribute('content')]));
  const twitter=Object.fromEntries([...document.querySelectorAll('meta[name^="twitter:"]')].map(node=>[node.getAttribute('name'),node.getAttribute('content')]));
  const blockingScripts=[...document.querySelectorAll('head script[src]')].filter(node=>!node.hasAttribute('defer')&&!node.hasAttribute('async')&&node.getAttribute('type')!=='module').map(node=>node.getAttribute('src'));
  return {
    title,titleLength:title?.length??0,description,descriptionLength:description?.length??0,
    h1:headings.filter(h=>h.level===1).map(h=>h.text),headingSkips:skips,
    canonical:document.querySelector('link[rel="canonical"]')?.getAttribute('href')??null,
    canonicalCount:document.querySelectorAll('link[rel="canonical"]').length,
    robots:meta('robots'),hreflang:[...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(node=>`${node.getAttribute('hreflang')} ${node.getAttribute('href')}`),
    lang:document.documentElement?.getAttribute('lang')??null,
    jsonld:jsonld.map(item=>item.error?{error:item.error}:{types:item.types}),jsonldRaw:jsonld.filter(item=>item.data).map(item=>item.data),
    og,twitter,images,links,blockingScripts,
    preloads:[...document.querySelectorAll('link[rel="preload"]')].map(node=>node.getAttribute('href')),
    metaRefresh:document.querySelector('meta[http-equiv="refresh"]')?.getAttribute('content')??null
  };
}

async function renderPages(pages){
  const {chromium}=await import('playwright-core');
  const executablePath=process.env.CHROME_PATH||['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome'].find(existsSync);
  const browser=await chromium.launch({executablePath,headless:true});
  const context=await browser.newContext({userAgent});
  try{
    await pool(pages,async page=>{
      const tab=await context.newPage();
      try{
        await tab.goto(page.url,{waitUntil:'networkidle',timeout:45000});
        page.rendered=await tab.evaluate(()=>({
          title:document.title,h1:[...document.querySelectorAll('h1')].map(node=>node.textContent.replace(/\s+/g,' ').trim()),
          canonical:document.querySelector('link[rel="canonical"]')?.href??null,robots:document.querySelector('meta[name="robots"]')?.content??null,
          jsonld:[...document.querySelectorAll('script[type="application/ld+json"]')].map(node=>{try{const data=JSON.parse(node.textContent);const items=Array.isArray(data)?data:data['@graph']||[data];return {types:items.map(item=>item['@type']).flat()}}catch(error){return {error:String(error.message)}}}),
          links:[...new Set([...document.querySelectorAll('a[href]')].map(anchor=>anchor.href.split('#')[0]))]
        }));
      }catch(error){page.rendered={error:String(error.message||error)};}
      await tab.close();
    });
  }finally{await browser.close();}
}

const report={site:origin,crawledAt:new Date().toISOString(),userAgent,robotsTxt:null,sitemap:{},hostChecks:[],pages:[],images:[],issues:{}};
const robots=await request(`${origin}/robots.txt`);
report.robotsTxt={status:robots.status,body:robots.body};
const sitemapResponse=await request(`${origin}/sitemap.xml`);
const sitemapUrls=[...sitemapResponse.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1].trim());
const sitemapLastmods=Object.fromEntries([...sitemapResponse.body.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map(match=>[match[1].trim(),match[2].trim()]));
report.sitemap={status:sitemapResponse.status,contentType:sitemapResponse.headers['content-type'],count:sitemapUrls.length,urls:sitemapUrls,lastmods:sitemapLastmods};

if(base.hostname==='suvarnatantu.com'){
  for(const probe of ['http://suvarnatantu.com/','http://www.suvarnatantu.com/','https://www.suvarnatantu.com/','https://suvarnatantu.com/about-us','https://suvarnatantu.com/about-us.html','https://suvarnatantu.com/index.html','https://suvarnatantu.com/products/?utm_source=audit']){
    const result=await follow(probe);report.hostChecks.push({probe,chain:result.chain,final:result.finalUrl});await sleep(150);
  }
}else{
  for(const path of ['/about-us','/about-us.html','/index.html']){const result=await follow(origin+path);report.hostChecks.push({probe:origin+path,chain:result.chain,final:result.finalUrl});}
}

const seen=new Map(),queue=[`${origin}/`,...sitemapUrls.map(url=>internal(url)?toLocal(url):url),`${origin}/this-page-should-not-exist-seo-audit/`];
const linkSources=new Map();
while(queue.length&&seen.size<maxPages){
  const batch=[...new Map(queue.splice(0,concurrency*4).filter(url=>!seen.has(pageKey(url))).map(url=>[pageKey(url),url])).values()];
  batch.forEach(url=>seen.set(pageKey(url),null));
  const pages=await pool(batch,async url=>{
    const result=await follow(url);
    const page={url,path:pageKey(url),chain:result.chain,status:result.final.status,finalUrl:result.finalUrl,xRobotsTag:result.final.headers['x-robots-tag']||null,contentType:result.final.headers['content-type']||null,inSitemap:sitemapUrls.some(entry=>pageKey(entry)===pageKey(url))};
    if(result.final.status===200&&/html/.test(page.contentType||''))Object.assign(page,analyse(result.final.body,result.finalUrl));
    return page;
  });
  for(const page of pages){
    seen.set(page.path,page);report.pages.push(page);
    for(const link of page.links||[]){
      if(!internal(link))continue;const path=pageKey(link);
      if(!linkSources.has(path))linkSources.set(path,new Set());linkSources.get(path).add(page.path);
      if(!isAsset(path)&&!seen.has(path)&&!queue.some(url=>pageKey(url)===path))queue.push(toLocal(link));
    }
  }
}

const htmlPages=report.pages.filter(page=>page.status===200&&page.title!==undefined);
if(render)await renderPages(htmlPages);
for(const page of htmlPages)for(const link of page.rendered?.links||[]){if(!internal(link))continue;const path=pageKey(link);if(!linkSources.has(path))linkSources.set(path,new Set());linkSources.get(path).add(page.path);}

const imageUrls=[...new Set(htmlPages.flatMap(page=>(page.images||[]).map(image=>image.src).filter(Boolean).map(src=>new URL(src,page.finalUrl).href)).filter(internal).map(toLocal))];
// <img> fallbacks inside <picture> with a WebP/AVIF <source> are expected legacy formats.
const pictureFallbacks=new Set(htmlPages.flatMap(page=>(page.images||[]).filter(image=>image.inPicture&&image.src).map(image=>toLocal(new URL(image.src,page.finalUrl).href))));
report.images=await pool(imageUrls,async url=>{const result=await request(url,'HEAD');return {url,status:result.status,bytes:Number(result.headers['content-length']||0),type:result.headers['content-type']||null}});

const indexable=page=>page.status===200&&page.chain.length===1&&page.title!==undefined&&!/noindex/i.test(page.robots||'')&&!/noindex/i.test(page.xRobotsTag||'')&&!page.metaRefresh;
report.indexableUrls=htmlPages.filter(indexable).map(page=>page.path).sort();
const issues=report.issues,add=(key,value)=>(issues[key]??=[]).push(value);
const titles=new Map(),descriptions=new Map();
for(const page of report.pages){
  if(page.chain.length>2)add('redirectChains',page.chain.map(hop=>`${hop.status} ${hop.url}`).join(' -> '));
  if(page.status>=400&&page.path!=='/this-page-should-not-exist-seo-audit/')add('non200',`${page.status} ${page.path} (linked from ${[...(linkSources.get(page.path)||[])].slice(0,3).join(', ')||'sitemap'})`);
  if(!indexable(page))continue;
  if(!page.title)add('missingTitle',page.path);else if(page.titleLength>60)add('titleOver60',`${page.path} (${page.titleLength})`);
  if(!page.description)add('missingDescription',page.path);else if(page.descriptionLength<140||page.descriptionLength>160)add('descriptionOutside140to160',`${page.path} (${page.descriptionLength})`);
  if(page.title)titles.set(page.title,[...(titles.get(page.title)||[]),page.path]);
  if(page.description)descriptions.set(page.description,[...(descriptions.get(page.description)||[]),page.path]);
  if(page.h1.length!==1)add('h1CountNot1',`${page.path} (${page.h1.length})`);
  if(page.headingSkips.length)add('headingSkips',`${page.path}: ${[...new Set(page.headingSkips)].join(', ')}`);
  if(!page.canonical)add('missingCanonical',page.path);
  else{if(page.canonicalCount>1)add('multipleCanonicals',page.path);if(!page.canonical.startsWith(`${canonicalOrigin}/`))add('canonicalOffHost',`${page.path} -> ${page.canonical}`);if(pageKey(page.canonical)!==page.path)add('nonSelfCanonical',`${page.path} -> ${page.canonical}`);}
  if(!page.inSitemap)add('indexableNotInSitemap',page.path);
  if(!page.jsonld.length)add('noRawJsonLd',page.path);
  for(const item of page.jsonld)if(item.error)add('jsonLdParseErrors',`${page.path}: ${item.error}`);
  for(const key of ['og:title','og:description','og:url','og:image','og:type'])if(!page.og[key])add('missingOpenGraph',`${page.path}: ${key}`);
  for(const key of ['twitter:card','twitter:image'])if(!page.twitter[key])add('missingTwitter',`${page.path}: ${key}`);
  for(const image of page.images){if(image.alt===null)add('imagesMissingAlt',`${page.path}: ${image.src}`);if(!image.width||!image.height)add('imagesMissingDimensions',`${page.path}: ${image.src}`);}
  if(page.blockingScripts.length)add('renderBlockingScripts',`${page.path}: ${page.blockingScripts.join(', ')}`);
}
for(const [title,paths] of titles)if(paths.length>1)add('duplicateTitles',`${title}: ${paths.join(', ')}`);
for(const [description,paths] of descriptions)if(paths.length>1)add('duplicateDescriptions',`${description.slice(0,60)}...: ${paths.join(', ')}`);
for(const url of sitemapUrls){const page=seen.get(pageKey(url));if(!page||!indexable(page))add('sitemapUrlNotIndexable200',`${pageKey(url)} (${page?.status}${page&&/noindex/i.test(page.robots||'')?' noindex':''})`);}
for(const path of report.indexableUrls)if(path!=='/'&&!(linkSources.get(path)||new Set()).size)add('orphans',path);
const notFound=seen.get('/this-page-should-not-exist-seo-audit/');
report.notFoundCheck={status:notFound?.status,title:notFound?.title??null,robots:notFound?.robots??null};
if(notFound?.status!==404)add('soft404',`Unknown URL returned ${notFound?.status}`);
for(const image of report.images){if(image.status!==200)add('brokenImages',`${image.status} ${image.url}`);if(image.bytes>200000)add('heavyImages',`${image.url} (${Math.round(image.bytes/1024)} KB)`);if(image.type&&!/webp|avif|svg/.test(image.type)&&!pictureFallbacks.has(image.url))add('legacyImageFormats',`${image.url} (${image.type})`);}
report.summary=Object.fromEntries(Object.entries(issues).map(([key,list])=>[key,list.length]));
report.summary.pagesCrawled=report.pages.length;report.summary.indexable=report.indexableUrls.length;report.summary.sitemapUrls=sitemapUrls.length;

let compareFailures=[];
if(compareFile){
  const baseline=JSON.parse(await readFile(compareFile,'utf8'));
  for(const path of baseline.indexableUrls){
    const page=seen.get(path)||report.pages.find(entry=>entry.path===path);
    const fresh=page||await (async()=>{const result=await follow(origin+path);return {status:result.final.status,chain:result.chain}})();
    if(page&&page.status===200&&!indexable(page))compareFailures.push(`${path} became non-indexable (robots=${page.robots}, x-robots=${page.xRobotsTag})`);
    else if(fresh.status!==200)compareFailures.push(`${path} now returns ${fresh.status}`);
    else if(fresh.chain.length>2)compareFailures.push(`${path} now redirects through ${fresh.chain.length-1} hops`);
  }
  const disallow=/^disallow:\s*(\S+)/gim,rules=[...(report.robotsTxt.body||'').matchAll(disallow)].map(match=>match[1]);
  for(const path of baseline.indexableUrls)if(rules.some(rule=>path.startsWith(rule)))compareFailures.push(`${path} is disallowed by robots.txt`);
  report.compare={baseline:compareFile,failures:compareFailures};
}

if(outFile)await writeFile(outFile,`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report.summary,null,2));
if(compareFile){console.log(compareFailures.length?`Baseline comparison FAILED:\n${compareFailures.join('\n')}`:`Baseline comparison passed for ${JSON.parse(await readFile(compareFile,'utf8')).indexableUrls.length} URLs.`);if(compareFailures.length)process.exitCode=1;}
