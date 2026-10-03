import {access,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..'),site='https://suvarnatantu.com';
const redirects=JSON.parse(await readFile(resolve(root,'firebase.json'),'utf8')).hosting.redirects.map(rule=>rule.regex);
const sitemap=await readFile(resolve(root,'sitemap.xml'),'utf8');
const robots=await readFile(resolve(root,'robots.txt'),'utf8');
const homepage=await readFile(resolve(root,'index.html'),'utf8');
const entries=[...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g)].map(([,url,lastmod])=>({url,lastmod}));
const urls=entries.map(({url})=>url);
const requiredCanonicalPaths=['/','/products/','/metallic-yarn/','/zari-yarn/','/zari-yarn/imitation-zari/','/applications/','/zari-lab/','/manufacturing/','/industries/','/export/','/specifications/','/samples/','/about-us/','/contact/','/request-quote/','/privacy-policy/','/terms/','/blog/'];

if(!sitemap.startsWith('<?xml')||!sitemap.includes('<urlset '))throw Error('Sitemap XML is invalid.');
if(!robots.includes('Sitemap: https://suvarnatantu.com/sitemap.xml'))throw Error('robots.txt is missing the sitemap declaration.');
if(new Set(urls).size!==urls.length)throw Error('Sitemap contains duplicate URLs.');
if(entries.length!==[...sitemap.matchAll(/<url>/g)].length)throw Error('Every sitemap URL must contain one loc and one lastmod.');
for(const {url,lastmod} of entries){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)||Number.isNaN(new Date(`${lastmod}T00:00:00Z`).getTime()))throw Error(`Invalid sitemap lastmod for ${url}`);
  if(!url.startsWith(`${site}/`)||!url.endsWith('/')||new URL(url).search)throw Error(`Non-canonical sitemap URL: ${url}`);
}
for(const path of requiredCanonicalPaths)if(!urls.includes(site+path))throw Error(`Sitemap is missing ${path}`);
for(const url of urls)if(url.startsWith(`${site}/blog/`)&&url!==`${site}/blog/`)throw Error(`Sitemap contains a runtime-only Blog URL: ${url}`);
for(const path of ['/products.html','/blog.html'])if(urls.includes(site+path))throw Error(`Sitemap contains obsolete duplicate route ${path}`);
for(const url of urls)if(url.includes('enquiry-thank-you')||redirects.some(regex=>new RegExp(regex).test(new URL(url).pathname)))throw Error(`Sitemap contains a noindex or redirect-source URL: ${url}`);

for(const path of ['/industries/','/export/','/applications/','/zari-lab/','/manufacturing/'])if(!homepage.includes(`href="${path}"`))throw Error(`Homepage is missing ${path}`);
if(homepage.includes('nav-unavailable'))throw Error('Homepage retains obsolete unavailable navigation.');

const about=await readFile(resolve(root,'about-us.html'),'utf8');
for(const href of ['/manufacturing/','/zari-lab/','/products/','/applications/','/export/','/samples/','/blog/','/contact/'])if(!about.includes(`href="${href}"`))throw Error(`About page is missing ${href}`);

const blogHome=await readFile(resolve(root,'blog','index.html'),'utf8');
const productsHome=await readFile(resolve(root,'products','index.html'),'utf8');
for(const [html,canonical,path] of [[productsHome,`${site}/products/`,'products/index.html'],[blogHome,`${site}/blog/`,'blog/index.html']]){
  if((html.match(new RegExp(`rel="canonical" href="${canonical}"`,'g'))||[]).length!==1)throw Error(`${path} must claim its canonical URL exactly once.`);
}
if((blogHome.match(/<h1[ >]/g)||[]).length!==1)throw Error('Blog listing must have exactly one H1.');
for(const marker of ['data-blog-state="loading"','data-blog-state="ready"','data-blog-state="empty"','data-blog-state="unavailable"','suvarnatantu-blog-list.js'])if(!blogHome.includes(marker))throw Error(`Blog listing is missing ${marker}.`);

const detail=await readFile(resolve(root,'blog','post','index.html'),'utf8');
for(const marker of ['meta name="robots" content="noindex,follow"','data-blog-canonical','data-blog-schema','data-blog-breadcrumb-schema','suvarnatantu-blog-detail.js'])if(!detail.includes(marker))throw Error(`Blog detail shell is missing ${marker}.`);
if(detail.includes('rel="canonical" href='))throw Error('The runtime detail shell must not emit a false static canonical URL.');

for(const path of ['zari-lab/tpm/index.html','specifications/yarn-tpm-guide.html','zari-lab/denier/index.html','specifications/yarn-denier-guide.html'])if(!await access(resolve(root,path)).then(()=>true,()=>false))throw Error(`Missing technical SEO page: ${path}`);

console.log(`Validated ${urls.length} sitemap URLs and API-backed Blog listing/detail SEO fallbacks.`);
