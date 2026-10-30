import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseHTML} from 'linkedom';
import {parseSitemap,site,sourceForUrl} from './sitemap-utils.mjs';

// Pages whose structured data is owned by the API-backed site-help workstream (FAQPage is rendered from live content).
export const runtimeSchemaPaths=new Set(['/faq/','/policies/']);

export const organizationId=`${site}/#organization`;
export const websiteId=`${site}/#website`;
// Every value below is published on the live site (homepage, contact, privacy and terms pages).
export const organization={
  '@type':'Organization','@id':organizationId,name:'Suvarnatantu',url:`${site}/`,
  logo:{'@type':'ImageObject',url:`${site}/assets/images/suvarnatantu-logo-optimized.jpg`,width:512,height:512},
  parentOrganization:{'@type':'Organization',name:'Vastranand Pvt. Ltd.'},
  telephone:'+91-81540-00962',email:'suvarnatantu@gmail.com',
  address:{'@type':'PostalAddress',streetAddress:'Plot No. 998, Road No. 87, Sachin GIDC, Near Sutex Bank',addressLocality:'Surat',addressRegion:'Gujarat',postalCode:'394230',addressCountry:'IN'},
  contactPoint:{'@type':'ContactPoint',contactType:'sales',telephone:'+91-81540-00962',email:'suvarnatantu@gmail.com',availableLanguage:['en']}
};
const website={'@type':'WebSite','@id':websiteId,name:'Suvarnatantu',url:`${site}/`,inLanguage:'en',publisher:{'@id':organizationId}};
const collectionPages=new Set(['/applications/','/blog/','/colours/','/export/','/industries/','/manufacturing/','/metallic-yarn/','/products/','/specifications/','/zari-lab/','/zari-yarn/']);
const parentPages=[
  ['/products/','Products'],['/products/filament-yarn/','Filament Yarn'],['/products/metallic-zari/','Metallic Zari'],['/products/twisted-yarn/','Twisted Yarn'],
  ['/metallic-yarn/','Metallic Yarn'],['/zari-yarn/','Zari Yarn'],['/applications/','Applications'],['/colours/','Colours'],['/industries/','Industries'],
  ['/manufacturing/','Manufacturing'],['/zari-lab/','Zari Lab'],['/specifications/','Specifications'],['/export/','Exports']
];
export const SCHEMA_PATTERN=/<script type="application\/ld\+json" id="site-schema">[\s\S]*?<\/script>/;

const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const absolute=(href,base)=>{try{const url=new URL(href,base);url.hash='';url.search='';return url.origin===site?url.href:null}catch{return null}};

export function buildGraph(html,url,{titles=new Map(),indexable=new Set()}={}){
  const {document}=parseHTML(html);
  const path=new URL(url).pathname;
  const name=clean(document.querySelector('h1')?.textContent);
  const description=clean(document.querySelector('meta[name="description"]')?.getAttribute('content'));
  if(!name||!description)throw Error(`${path} needs one H1 and a meta description before structured data can be generated.`);
  const type=path==='/about-us/'?'AboutPage':path==='/contact/'?'ContactPage':collectionPages.has(path)?'CollectionPage':'WebPage';
  const page={'@type':type,'@id':`${url}#webpage`,url,name,description,inLanguage:'en',isPartOf:{'@id':websiteId},publisher:{'@id':organizationId}};
  const image=document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if(image?.startsWith(`${site}/`))page.primaryImageOfPage={'@type':'ImageObject',url:image};
  const graph=[page,organization];
  if(path==='/'){graph.push(website);page.about={'@id':organizationId};}
  else{
    const items=[{name:'Home',item:`${site}/`}];
    const nav=document.querySelector('nav.breadcrumb');
    if(nav){
      for(const anchor of nav.querySelectorAll('a[href]')){const item=absolute(anchor.getAttribute('href'),url),label=clean(anchor.textContent);if(item&&label&&!items.some(entry=>entry.item===item))items.push({name:label,item});}
    }else for(const [parent,label] of parentPages)if(parent!==path&&path.startsWith(parent))items.push({name:label,item:`${site}${parent}`});
    const trailing=nav?clean([...nav.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join(' ').split('/').map(clean).filter(Boolean).at(-1)):'';
    if(!items.some(entry=>entry.item===url))items.push({name:trailing||name,item:url});
    graph.push({'@type':'BreadcrumbList','@id':`${url}#breadcrumb`,itemListElement:items.map((entry,index)=>({'@type':'ListItem',position:index+1,name:entry.name,item:entry.item}))});
    page.breadcrumb={'@id':`${url}#breadcrumb`};
  }
  if(type==='CollectionPage'){
    const children=[];
    for(const anchor of document.querySelectorAll('main a[href]')){
      const item=absolute(anchor.getAttribute('href'),url);if(!item||children.includes(item))continue;
      const childPath=new URL(item).pathname;
      if(childPath.startsWith(path)&&childPath!==path&&childPath.slice(path.length).replace(/\/$/,'').split('/').length===1&&indexable.has(item)&&titles.has(item))children.push(item);
    }
    if(children.length>1){
      graph.push({'@type':'ItemList','@id':`${url}#itemlist`,name,numberOfItems:children.length,itemListElement:children.map((item,index)=>({'@type':'ListItem',position:index+1,url:item,name:titles.get(item)}))});
      page.mainEntity={'@id':`${url}#itemlist`};
    }
  }
  return {'@context':'https://schema.org','@graph':graph};
}

export const renderSchema=graph=>`<script type="application/ld+json" id="site-schema">${JSON.stringify(graph).replace(/</g,'\\u003c')}</script>`;

export function applySchema(html,block){
  if(SCHEMA_PATTERN.test(html))return html.replace(SCHEMA_PATTERN,()=>block);
  const index=html.indexOf('</head>');
  if(index<0)throw Error('Missing </head>.');
  return `${html.slice(0,index)}${block}\n${html.slice(index)}`;
}

// Returns every sitemap page that carries build-time structured data, with the expected HTML.
export async function structuredDataPlan(root){
  const entries=parseSitemap(await readFile(resolve(root,'sitemap.xml'),'utf8'));
  const pages=[];
  for(const {url} of entries){
    const source=sourceForUrl(root,url);
    if(!source)throw Error(`No source HTML found for ${url}`);
    pages.push({url,path:new URL(url).pathname,source,html:await readFile(resolve(root,source),'utf8')});
  }
  const titles=new Map(pages.map(page=>[page.url,clean(parseHTML(page.html).document.querySelector('h1')?.textContent)]));
  const indexable=new Set(pages.map(page=>page.url));
  return pages.filter(page=>!runtimeSchemaPaths.has(page.path)).map(page=>({...page,expected:applySchema(page.html,renderSchema(buildGraph(page.html,page.url,{titles,indexable})))}));
}
