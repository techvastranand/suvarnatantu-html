import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gitDate,normalizeDate,parseSitemap,site,sourceForUrl} from './sitemap-utils.mjs';

const root=resolve(import.meta.dirname,'..');
const sitemap=parseSitemap(await readFile(resolve(root,'sitemap.xml'),'utf8'));
if(!sitemap.length)throw Error('Sitemap contains no URLs.');

const urls=sitemap.map(({url})=>url);
if(new Set(urls).size!==urls.length)throw Error('Sitemap contains duplicate URLs.');
if(!urls.includes(`${site}/blog/`))throw Error('Sitemap is missing the canonical Blog listing.');
if(urls.some(url=>url.startsWith(`${site}/blog/`)&&url!==`${site}/blog/`))throw Error('Sitemap must not contain runtime article, archive, category, or query-string Blog URLs.');

for(const {url,lastmod} of sitemap){
  let parsed;
  try{parsed=new URL(url);}catch{throw Error(`Invalid sitemap URL: ${url}`);}
  if(parsed.origin!==site||parsed.username||parsed.password||!parsed.pathname.startsWith('/')||!parsed.pathname.endsWith('/')||parsed.search||parsed.hash)throw Error(`Non-canonical sitemap URL: ${url}`);
  if(/\.html(?:\/|$)/i.test(parsed.pathname))throw Error(`Public .html URL found in sitemap: ${url}`);
  if(parsed.pathname==='/404/'||parsed.pathname.includes('enquiry-thank-you'))throw Error(`Private or utility URL found in sitemap: ${url}`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)||normalizeDate(`${lastmod}T00:00:00Z`)!==lastmod)throw Error(`Invalid sitemap lastmod for ${url}: ${lastmod}`);
  const source=sourceForUrl(root,url);
  if(!source)throw Error(`No source HTML found for static sitemap URL: ${url}`);
  const html=await readFile(resolve(root,source),'utf8');
  if(/<meta\b[^>]*\bcontent=["'][^"']*\bnoindex\b[^"']*["'][^>]*>/i.test(html))throw Error(`Noindex source found in sitemap: ${url}`);
  const expected=gitDate(root,source);
  if(!expected)throw Error(`No Git modification date found for ${source}`);
  if(lastmod!==expected)throw Error(`Stale static lastmod for ${url}: expected ${expected}, found ${lastmod}`);
}

console.log(`Validated ${sitemap.length} canonical sitemap URLs with static Git dates.`);
