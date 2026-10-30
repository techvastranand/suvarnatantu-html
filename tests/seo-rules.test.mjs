import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {checkJsonLd,checkSite,redirectErrors,resolveInternalHref} from '../scripts/seo-rules.mjs';
import {buildGraph} from '../scripts/structured-data.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));

test('every sitemap page passes the technical SEO rules',async()=>{
  const {errors,checked}=await checkSite(root);
  assert.deepEqual(errors,[]);
  assert.ok(checked>=80);
});

test('JSON-LD must parse and carry the required properties',()=>{
  assert.match(checkJsonLd('{"@context":"https://schema.org",','x')[0],/does not parse/);
  assert.match(checkJsonLd('{"@context":"https://schema.org","@type":"Organization","name":"A","url":"https://a/"}','x').join(),/missing logo/);
  assert.match(checkJsonLd('{"@context":"https://schema.org","@type":"Product","name":"A"}','x').join(),/offers, review or aggregateRating/);
  assert.match(checkJsonLd('{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":2,"name":"A","item":"https://a/"}]}','x').join(),/position, name and URL/);
  assert.deepEqual(checkJsonLd('{"@context":"https://schema.org","@type":"WebSite","name":"A","url":"https://a/"}','x'),[]);
});

test('internal links may not point at redirects, missing pages or slashless URLs',()=>{
  const redirects=[/^\/(?:blog\/)?what-is-metallic-yarn(?:\/|\/index\.html)?$/];
  assert.equal(resolveInternalHref(root,'/blog/what-is-metallic-yarn/',redirects).ok,false);
  assert.equal(resolveInternalHref(root,'/colours/gold',redirects).ok,false);
  assert.equal(resolveInternalHref(root,'/no-such-page/',redirects).ok,false);
  assert.equal(resolveInternalHref(root,'/colours/gold/',redirects).ok,true);
  assert.equal(resolveInternalHref(root,'/blog/post/?slug=a',redirects).ok,true);
});

test('legacy .html files must redirect in one hop and redirect targets may not redirect again',()=>{
  const legacy=[{regex:'^/applications/saree-weaving/?$',destination:'/applications/saree/'}];
  assert.match(redirectErrors(root,legacy,['applications/saree-weaving.html'])[0],/cleanUrls hop/);
  assert.deepEqual(redirectErrors(root,[{regex:'^/applications/saree-weaving(?:\\.html)?/?$',destination:'/applications/saree/'}],['applications/saree-weaving.html']),[]);
  assert.match(redirectErrors(root,[{regex:'^/a/?$',destination:'/b/'},{regex:'^/b/?$',destination:'/c/'}],[])[0],/chain/);
});

test('build-time structured data uses the breadcrumb, H1 and real child pages only',()=>{
  const html='<html><head><meta name="description" content="D"><meta property="og:image" content="https://suvarnatantu.com/i.jpg"></head><body><main><nav class="breadcrumb"><a href="/">Home</a> / <a href="/colours/">Colours</a> / Gold</nav><h1>Gold Yarn</h1></main></body></html>';
  const graph=buildGraph(html,'https://suvarnatantu.com/colours/gold/')['@graph'];
  const crumbs=graph.find(node=>node['@type']==='BreadcrumbList').itemListElement;
  assert.deepEqual(crumbs.map(item=>item.name),['Home','Colours','Gold']);
  assert.equal(graph.find(node=>node['@type']==='WebPage').name,'Gold Yarn');
  assert.ok(!graph.some(node=>node['@type']==='Product'));
  const hub='<html><head><meta name="description" content="D"></head><body><main><h1>Colours</h1><a href="/colours/gold/">x</a><a href="/colours/silver/">y</a><a href="/colours/unknown/">z</a></main></body></html>';
  const list=buildGraph(hub,'https://suvarnatantu.com/colours/',{titles:new Map([['https://suvarnatantu.com/colours/gold/','Gold'],['https://suvarnatantu.com/colours/silver/','Silver']]),indexable:new Set(['https://suvarnatantu.com/colours/gold/','https://suvarnatantu.com/colours/silver/'])})['@graph'].find(node=>node['@type']==='ItemList');
  assert.deepEqual(list.itemListElement.map(item=>item.name),['Gold','Silver']);
});
