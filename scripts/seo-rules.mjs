import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseHTML} from 'linkedom';
import {parseSitemap,site,sourceForUrl} from './sitemap-utils.mjs';
import {runtimeSchemaPaths,structuredDataPlan} from './structured-data.mjs';

export const TITLE_MAX=60,DESCRIPTION_MIN=140,DESCRIPTION_MAX=160;
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const assetPattern=/\.(?:css|js|mjs|json|webp|avif|png|jpe?g|gif|svg|ico|pdf|xml|txt|woff2?)$/i;

// Required properties for the schema.org types this site publishes in raw HTML.
const requiredProperties={
  Organization:['name','url','logo'],WebSite:['name','url'],WebPage:['name','url'],CollectionPage:['name','url'],AboutPage:['name','url'],ContactPage:['name','url'],
  BreadcrumbList:['itemListElement'],ItemList:['itemListElement'],FAQPage:['mainEntity']
};
export function checkJsonLd(text,label){
  const errors=[];let data;
  try{data=JSON.parse(text);}catch(error){return [`${label}: JSON-LD does not parse (${error.message})`];}
  const nodes=Array.isArray(data)?data:data['@graph']||[data];
  if(!String(data['@context']||'').startsWith('https://schema.org'))errors.push(`${label}: JSON-LD needs @context https://schema.org`);
  for(const node of nodes){
    const type=node['@type'];
    for(const key of requiredProperties[type]||[])if(node[key]===undefined||node[key]===''||(Array.isArray(node[key])&&!node[key].length))errors.push(`${label}: ${type} is missing ${key}`);
    if(type==='BreadcrumbList'||type==='ItemList')node.itemListElement?.forEach((item,index)=>{if(item.position!==index+1||!item.name||!(item.item||item.url))errors.push(`${label}: ${type} item ${index+1} needs position, name and URL`)});
    if(type==='Product'&&!node.offers&&!node.review&&!node.aggregateRating)errors.push(`${label}: Product needs offers, review or aggregateRating; publish it only with real commercial data`);
  }
  return errors;
}

// Firebase applies redirects to the requested path before cleanUrls, so every legacy .html file must redirect in one hop.
export function redirectErrors(root,rules,htmlFiles){
  const errors=[],patterns=rules.map(rule=>({...rule,pattern:new RegExp(rule.regex)}));
  for(const rule of patterns)if(patterns.some(other=>other.pattern.test(rule.destination)))errors.push(`firebase.json redirect to ${rule.destination} is itself redirected (chain)`);
  for(const file of htmlFiles){
    const htmlPath=`/${file}`,cleanPath=`/${file.replace(/(?:\/?index)?\.html$/,'')}/`.replace(/\/+/g,'/');
    if(patterns.some(rule=>rule.pattern.test(cleanPath))&&!patterns.some(rule=>rule.pattern.test(htmlPath)))errors.push(`${htmlPath} reaches a redirect only after the cleanUrls hop; extend its firebase.json regex to match the .html path`);
  }
  return errors;
}

export function resolveInternalHref(root,href,redirects){
  const url=new URL(href,`${site}/`);
  if(url.origin!==site)return {ok:true};
  const path=decodeURIComponent(url.pathname);
  if(redirects.some(regex=>regex.test(path)))return {ok:false,reason:'links to a redirect source'};
  if(assetPattern.test(path))return {ok:existsSync(resolve(root,`.${path}`)),reason:'missing asset'};
  if(path==='/')return {ok:true};
  if(!path.endsWith('/'))return {ok:false,reason:'missing trailing slash (cleanUrls redirect)'};
  return {ok:Boolean(sourceForUrl(root,`${site}${path}`)),reason:'no page for this path'};
}

export async function checkSite(root){
  const errors=[],fail=message=>errors.push(message);
  const firebase=JSON.parse(await readFile(resolve(root,'firebase.json'),'utf8'));
  const redirects=firebase.hosting.redirects.map(rule=>new RegExp(rule.regex));
  const entries=parseSitemap(await readFile(resolve(root,'sitemap.xml'),'utf8'));
  const titles=new Map(),descriptions=new Map(),linkSources=[];
  for(const {url} of entries){
    const path=new URL(url).pathname,source=sourceForUrl(root,url),label=path;
    if(!source){fail(`${label}: no source HTML`);continue;}
    const html=await readFile(resolve(root,source),'utf8'),{document}=parseHTML(html);
    const metaContent=selector=>document.querySelector(selector)?.getAttribute('content');
    const titleNodes=document.querySelectorAll('head title'),title=clean(titleNodes[0]?.textContent),description=clean(metaContent('meta[name="description"]'));
    const runtimeOwned=runtimeSchemaPaths.has(path);
    if(titleNodes.length!==1||!title)fail(`${label}: needs exactly one non-empty <title>`);
    if(document.querySelectorAll('meta[name="description"]').length!==1||!description)fail(`${label}: needs exactly one meta description`);
    if(!runtimeOwned){
      if(title.length>TITLE_MAX)fail(`${label}: title is ${title.length} characters (max ${TITLE_MAX})`);
      if(description.length<DESCRIPTION_MIN||description.length>DESCRIPTION_MAX)fail(`${label}: meta description is ${description.length} characters (${DESCRIPTION_MIN}-${DESCRIPTION_MAX})`);
      titles.set(title,[...(titles.get(title)||[]),path]);descriptions.set(description,[...(descriptions.get(description)||[]),path]);
    }
    if(/noindex/i.test(metaContent('meta[name="robots"]')||''))fail(`${label}: sitemap page is noindex`);
    const canonicals=document.querySelectorAll('link[rel="canonical"]');
    if(canonicals.length!==1||canonicals[0].getAttribute('href')!==url)fail(`${label}: needs exactly one self-referencing canonical ${url}`);
    const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(node=>Number(node.tagName[1]));
    if(headings.filter(level=>level===1).length!==1)fail(`${label}: needs exactly one H1`);
    headings.forEach((level,index)=>{if(index&&level>headings[index-1]+1)fail(`${label}: heading jumps from h${headings[index-1]} to h${level}`)});
    for(const property of ['og:type','og:title','og:description','og:url','og:image','og:site_name'])if(!metaContent(`meta[property="${property}"]`))fail(`${label}: missing ${property}`);
    for(const name of ['twitter:card','twitter:title','twitter:description','twitter:image'])if(!metaContent(`meta[name="${name}"]`))fail(`${label}: missing ${name}`);
    if(metaContent('meta[property="og:url"]')&&metaContent('meta[property="og:url"]')!==url)fail(`${label}: og:url must equal the canonical URL`);
    for(const image of [metaContent('meta[property="og:image"]'),metaContent('meta[name="twitter:image"]')].filter(Boolean)){
      if(!image.startsWith(`${site}/`)||!existsSync(resolve(root,`.${new URL(image).pathname}`)))fail(`${label}: share image ${image} must be an existing file on ${site}`);
    }
    for(const img of document.querySelectorAll('img')){
      const src=img.getAttribute('src')||'';
      if(!img.hasAttribute('alt'))fail(`${label}: <img ${src}> needs an alt attribute`);
      if(!img.getAttribute('width')||!img.getAttribute('height'))fail(`${label}: <img ${src}> needs width and height`);
      if(/\.(?:png|jpe?g)$/i.test(src)&&!img.parentElement?.matches('picture')&&!/data-detail-image/.test(img.outerHTML))fail(`${label}: <img ${src}> needs a WebP/AVIF source`);
    }
    for(const script of document.querySelectorAll('head script[src]'))if(!script.hasAttribute('defer')&&!script.hasAttribute('async')&&script.getAttribute('type')!=='module')fail(`${label}: render-blocking script ${script.getAttribute('src')}`);
    document.querySelectorAll('script[type="application/ld+json"]').forEach((node,index)=>{if(clean(node.textContent))errors.push(...checkJsonLd(node.textContent,`${label} JSON-LD #${index+1}`));});
    if(!runtimeOwned&&!document.getElementById('site-schema'))fail(`${label}: missing build-time JSON-LD (run npm run update:structured-data)`);
    linkSources.push([label,[...document.querySelectorAll('a[href]')].map(anchor=>anchor.getAttribute('href'))]);
  }
  for(const [value,paths] of [...titles,...descriptions])if(paths.length>1)fail(`Duplicate title/description "${value.slice(0,60)}" on ${paths.join(', ')}`);
  for(const page of await structuredDataPlan(root))if(page.expected!==page.html)fail(`${page.path}: build-time JSON-LD is stale (run npm run update:structured-data)`);

  for(const file of ['assets/js/site-shell.js','assets/js/site-shell-links.js','404.html'])linkSources.push([file,[...(await readFile(resolve(root,file),'utf8')).matchAll(/href="([^"$`{}]+)"/g)].map(match=>match[1])]);
  for(const [label,hrefs] of linkSources)for(const href of new Set(hrefs)){
    if(!href.startsWith('/')||href.startsWith('//'))continue;
    const result=resolveInternalHref(root,href,redirects);
    if(!result.ok)fail(`${label}: internal link ${href} ${result.reason}`);
  }

  const notFound=await readFile(resolve(root,'404.html'),'utf8');
  if(!/<meta name="robots" content="noindex/.test(notFound)||!notFound.includes('href="/"'))fail('404.html must be noindex and link back to the homepage');
  const robots=await readFile(resolve(root,'robots.txt'),'utf8');
  for(const [,rule] of robots.matchAll(/^disallow:\s*(\S+)/gim))for(const {url} of entries)if(new URL(url).pathname.startsWith(rule))fail(`robots.txt disallows sitemap URL ${url}`);

  const {execFileSync}=await import('node:child_process');
  const htmlFiles=execFileSync('git',['ls-files','*.html'],{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean);
  errors.push(...redirectErrors(root,firebase.hosting.redirects,htmlFiles));
  return {errors,checked:entries.length};
}
