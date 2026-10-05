import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {DOMParser} from 'linkedom';
import {
  BlogApiError,
  detailUrl,
  fetchBlogDetail,
  fetchBlogPage,
  parseBlogPage,
  resolveBlogSlug,
  runtimeApiRoot,
  validatePost,
} from '../assets/js/suvarnatantu-blog-api.js';
import {sanitizeArticleHtml} from '../assets/js/suvarnatantu-blog-sanitize.js';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const fixture=(overrides={})=>({
  title:'A practical metallic yarn guide',
  slug:'practical-metallic-yarn-guide',
  excerpt:'A concise sourcing guide.',
  body_html:'<h2>Choose a construction</h2><p>Match denier and twist to the application.</p>',
  featured_media:{url:'https://cdn.example.com/yarn.webp',alt_text:'Gold metallic yarn',width:1200,height:750,content_type:'image/webp'},
  featured_image_alt:'Gold metallic yarn on a cone',
  author_name:'Suvarnatantu Technical Team',
  primary_category:{name:'Technical Knowledge',slug:'technical-knowledge'},
  tags:[{name:'Metallic Yarn',slug:'metallic-yarn'}],
  published_at:'2026-10-01T08:00:00Z',
  seo_title:'Metallic yarn guide',
  seo_description:'Technical metallic yarn guidance.',
  canonical_url:'',
  og_title:'Metallic yarn guide',
  og_description:'Technical metallic yarn guidance.',
  og_media:null,
  updated_at:'2026-10-02T08:00:00Z',
  ...overrides,
});
const envelope=data=>({message:'ok',data});
const page=data=>envelope({page:1,limit:20,records_total:data.length,records_filtered:data.length,data,content_version:'v1'});
const response=(status,payload)=>({ok:status>=200&&status<300,status,json:async()=>payload});

test('valid published list records are mapped from the public envelope',async()=>{
  const calls=[];
  const result=await fetchBlogPage({
    category:'technical-knowledge',
    apiRoot:'https://api.example.test/blogs',
    fetchImpl:async(url,options)=>{calls.push({url,options});return response(200,page([fixture()]));},
  });
  assert.equal(result.posts.length,1);
  assert.equal(result.posts[0].status,'published');
  assert.equal(result.posts[0].featuredMedia.url,'https://cdn.example.com/yarn.webp');
  assert.match(calls[0].url,/page=1/);
  assert.match(calls[0].url,/category=technical-knowledge/);
  assert.equal(calls[0].options.credentials,'omit');
  assert.equal(calls[0].options.headers.Accept,'application/json');
});

test('draft, archived and unknown statuses are defensively hidden',()=>{
  for(const status of ['draft','archived','review']){
    const parsed=parseBlogPage(page([fixture({status})]));
    assert.equal(parsed.posts.length,0);
    assert.equal(parsed.hiddenCount,1);
  }
  assert.equal(validatePost(fixture({status:'published'})).kind,'published');
});

test('empty pages are valid and malformed records are counted without rendering',()=>{
  assert.deepEqual(parseBlogPage(page([])).posts,[]);
  const result=parseBlogPage(page([fixture({slug:'Not valid'}),fixture()]));
  assert.equal(result.posts.length,1);
  assert.equal(result.malformedCount,1);
});

test('malformed envelopes fail closed',()=>{
  for(const payload of [{},envelope(null),envelope({page:1,limit:20,data:[]})]){
    assert.throws(()=>parseBlogPage(payload),error=>error instanceof BlogApiError&&error.kind==='malformed');
  }
});

test('API outage can be retried without stale data',async()=>{
  let attempts=0;
  const fetchImpl=async()=>{
    attempts+=1;
    return attempts===1?response(503,{}):response(200,page([fixture()]));
  };
  await assert.rejects(fetchBlogPage({apiRoot:'https://api.example.test/blogs',fetchImpl}),error=>error.kind==='unavailable');
  const retried=await fetchBlogPage({apiRoot:'https://api.example.test/blogs',fetchImpl});
  assert.equal(retried.posts.length,1);
  assert.equal(attempts,2);
});

test('detail handles published, unknown, unpublished and outage responses',async()=>{
  const published=await fetchBlogDetail('practical-metallic-yarn-guide',{apiRoot:'https://api.example.test/blogs',fetchImpl:async()=>response(200,envelope(fixture()))});
  assert.equal(published.slug,'practical-metallic-yarn-guide');
  await assert.rejects(fetchBlogDetail('unknown-post',{apiRoot:'https://api.example.test/blogs',fetchImpl:async()=>response(404,{})}),error=>error.kind==='not-found');
  await assert.rejects(fetchBlogDetail('draft-post',{apiRoot:'https://api.example.test/blogs',fetchImpl:async()=>response(200,envelope(fixture({slug:'draft-post',status:'draft'})))}),error=>error.kind==='not-found');
  await assert.rejects(fetchBlogDetail('practical-metallic-yarn-guide',{apiRoot:'https://api.example.test/blogs',fetchImpl:async()=>{throw new Error('offline');}}),error=>error.kind==='unavailable');
});

test('missing and invalid slugs are rejected and legacy slugs resolve',()=>{
  assert.equal(resolveBlogSlug({href:'https://suvarnatantu.com/blog/post/'}),null);
  assert.equal(resolveBlogSlug({href:'https://suvarnatantu.com/blog/post/?slug=Bad%20Slug'}),null);
  assert.equal(resolveBlogSlug({href:'https://suvarnatantu.com/blog/what-is-metallic-yarn/'}),'what-is-metallic-yarn');
  assert.equal(resolveBlogSlug({href:'https://suvarnatantu.com/blog/post/?slug=new-article'}),'new-article');
  assert.equal(detailUrl('new-article'),'/blog/post/?slug=new-article');
});

test('local fixture API overrides cannot affect the production hostname',()=>{
  assert.equal(runtimeApiRoot({hostname:'localhost'},'http://127.0.0.1:8099/api'),'http://127.0.0.1:8099/api');
  assert.equal(runtimeApiRoot({hostname:'suvarnatantu.com'},'http://127.0.0.1:8099/api'),'https://api.vastranand.com/v1/suvarnatantu/blogs');
});

test('article HTML sanitizer removes active content, handlers and unsafe URLs',()=>{
  const dirty='<h2 id="safe">Title</h2><script>alert(1)</script><p onclick="evil()">Text <a href="javascript:evil()" target="_blank">bad</a></p><svg><script>svg()</script></svg><img src="data:text/html,bad" onerror="evil()">';
  const clean=sanitizeArticleHtml(dirty,new DOMParser());
  assert.match(clean,/<h2 id="safe">Title<\/h2>/);
  assert.doesNotMatch(clean,/script|onclick|onerror|javascript:|data:text|<svg/i);
  assert.doesNotMatch(clean,/alert\(1\)|svg\(\)/);
});

test('article HTML sanitizer preserves safe formatting, links, images, tables and code',()=>{
  const safe='<blockquote><strong>Quote</strong></blockquote><a href="https://example.com/read">Read</a><img src="https://cdn.example.com/a.webp" alt="Yarn"><table><tr><th scope="col">Denier</th><td>120</td></tr></table><pre><code class="language-css">a{color:gold}</code></pre>';
  const clean=sanitizeArticleHtml(safe,new DOMParser());
  assert.match(clean,/blockquote/);
  assert.match(clean,/href="https:\/\/example.com\/read"/);
  assert.match(clean,/rel="noopener noreferrer"/);
  assert.match(clean,/loading="lazy"/);
  assert.match(clean,/<table>/);
  assert.match(clean,/language-css/);
});

test('static routes, fallback image and runtime sitemap behavior are present',()=>{
  const list=read('blog/index.html');
  const detail=read('blog/post/index.html');
  const listController=read('assets/js/suvarnatantu-blog-list.js');
  assert.match(list,/No published articles yet/);
  assert.match(detail,/data-blog-state="not-found"/);
  assert.match(listController,/gold-metallic-yarn-texture\.jpg/);
  assert.match(listController,/addEventListener\("error"/);
  for(const slug of ['how-to-send-yarn-sample-reference','b2b-yarn-specification-checklist','metallic-yarn-trends-textile-manufacturing','how-to-choose-metallic-yarn-supplier-india','how-metallic-yarn-is-made','best-zari-yarn-for-saree-weaving','what-is-metallic-yarn','what-is-tpm-in-zari-yarn','what-is-denier-in-metallic-yarn']){
    assert.equal(existsSync(new URL(`blog/${slug}/index.html`,root)),true);
    assert.match(read(`blog/${slug}/index.html`),/url=\/blog\//);
  }
  const sitemap=read('sitemap.xml');
  assert.match(sitemap,/<loc>https:\/\/suvarnatantu\.com\/blog\/<\/loc>/);
  assert.doesNotMatch(sitemap,/<loc>https:\/\/suvarnatantu\.com\/blog\/(?!<)/);
  assert.doesNotMatch(sitemap,/\?slug=/);
});

test('provider runtime references and old build dependencies are absent',()=>{
  const sources=['blog/index.html','blog/post/index.html','assets/js/suvarnatantu-blog-api.js','assets/js/suvarnatantu-blog-list.js','assets/js/suvarnatantu-blog-detail.js','package.json','.github/workflows/firebase-hosting-merge.yml'].map(read).join('\n');
  assert.doesNotMatch(sources,/ghost\.io|ghost\/api\/content|@tryghost|GHOST_CONTENT_API|storage\.ghost\.io/i);
  assert.doesNotMatch(read('package.json'),/sharp|build:blog/);
});

test('Reviewed legacy routing and unchanged enquiry client',()=>{
  const digest=path=>createHash('sha256').update(read(path).replaceAll('\r\n','\n')).digest('hex');
  assert.equal(digest('firebase.json'),'5173bc14679d1e55eaf5ae91052ff38963854853ce904a3308356be4d1ff1895');
  assert.equal(digest('assets/js/b2b-flow.js'),'cea8c1afcb6b056579ae3644f0982680f1499be80420635ed51097cee3997f63');
});
