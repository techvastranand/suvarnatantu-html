import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gitDate,parseSitemap,renderSitemap,site,sourceForUrl} from './sitemap-utils.mjs';

const root=resolve(import.meta.dirname,'..'),sitemapFile=resolve(root,'sitemap.xml');
const existing=await readFile(sitemapFile,'utf8');
const entries=parseSitemap(existing);
const retained=entries.filter(({url})=>!url.startsWith(`${site}/blog/`)||url===`${site}/blog/`);
const urls=retained.map(({url})=>url);
if(new Set(urls).size!==urls.length)throw Error('Sitemap contains duplicate URLs; refusing to rewrite it.');

let refreshed=0;
const updated=retained.map(entry=>{
  const source=sourceForUrl(root,entry.url);
  if(!source)throw Error(`No source HTML found for static sitemap URL: ${entry.url}`);
  const lastmod=gitDate(root,source);
  if(!lastmod)throw Error(`No Git modification date found for ${source}`);
  if(lastmod!==entry.lastmod)refreshed++;
  return {url:entry.url,lastmod};
});

const output=renderSitemap(updated);
const outputUrls=parseSitemap(output).map(({url})=>url);
if(outputUrls.length!==urls.length||outputUrls.some((url,index)=>url!==urls[index]))throw Error('Sitemap URL preservation check failed.');
await writeFile(sitemapFile,output);
console.log(`Refreshed ${refreshed} lastmod dates, removed ${entries.length-retained.length} runtime-only Blog URLs, and retained ${retained.length} canonical URLs.`);
