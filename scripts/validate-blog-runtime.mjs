import {createHash} from 'node:crypto';
import {access,readdir,readFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const legacySlugs=[
  'how-to-send-yarn-sample-reference',
  'b2b-yarn-specification-checklist',
  'metallic-yarn-trends-textile-manufacturing',
  'how-to-choose-metallic-yarn-supplier-india',
  'how-metallic-yarn-is-made',
  'best-zari-yarn-for-saree-weaving',
  'what-is-metallic-yarn',
  'what-is-tpm-in-zari-yarn',
  'what-is-denier-in-metallic-yarn',
];
const expectedFirebaseHash='01db34ef841aff399ea6a27479a501a7a8a235250d92bcb2d5397676134a8a4a';
const hash=text=>createHash('sha256').update(text.replaceAll('\r\n','\n')).digest('hex');
const read=path=>readFile(resolve(root,path),'utf8');
const exists=path=>access(resolve(root,path)).then(()=>true,()=>false);

async function filesBelow(path){
  const absolute=resolve(root,path);
  const entries=await readdir(absolute,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    const child=resolve(absolute,entry.name);
    if(entry.isDirectory())files.push(...await filesBelow(relative(root,child)));
    else files.push(child);
  }
  return files;
}

const api=await read('assets/js/suvarnatantu-blog-api.js');
for(const requirement of [
  'https://api.vastranand.com/v1/suvarnatantu/blogs',
  'credentials: "omit"',
  'AbortController',
  'DEFAULT_TIMEOUT_MS',
  'value.status !== "published"',
  'throw new BlogApiError("malformed")',
])if(!api.includes(requirement))throw Error(`Blog API client is missing ${requirement}.`);
if(/authorization|admin[_-]?jwt|bearer/i.test(api))throw Error('Public Blog client contains an authentication reference.');

const listing=await read('blog/index.html');
const listingController=await read('assets/js/suvarnatantu-blog-list.js');
for(const state of ['loading','ready','empty','unavailable'])if(!listing.includes(`data-blog-state="${state}"`))throw Error(`Blog listing is missing the ${state} state.`);
for(const requirement of ['data-blog-retry','No published articles yet','data-blog-grid','data-blog-pagination'])if(!listing.includes(requirement))throw Error(`Blog listing is missing ${requirement}.`);
for(const requirement of ['fetchBlogPage','FALLBACK_IMAGE','malformedCount','activeController?.abort()'])if(!listingController.includes(requirement))throw Error(`Blog listing controller is missing ${requirement}.`);

const detail=await read('blog/post/index.html');
const detailController=await read('assets/js/suvarnatantu-blog-detail.js');
for(const state of ['loading','ready','missing','invalid','not-found','unavailable'])if(!detail.includes(`data-blog-state="${state}"`))throw Error(`Blog detail is missing the ${state} state.`);
for(const requirement of ['fetchBlogDetail','resolveBlogSlug','sanitizeArticleHtml(post.bodyHtml)','data-blog-retry','updateMetadata'])if(!detailController.includes(requirement))throw Error(`Blog detail controller is missing ${requirement}.`);

for(const slug of legacySlugs){
  const path=`blog/${slug}/index.html`;
  if(!await exists(path))throw Error(`Missing legacy Blog route ${path}.`);
  const html=await read(path);
  if(!html.includes('suvarnatantu-blog-detail.js')||html.includes('storage.ghost.io'))throw Error(`Legacy Blog route is not an API detail shell: ${path}.`);
}

for(const removed of [
  '.env.example','blog/.ghost-generated.json','blog/ghost-state.json','scripts/build-blog.mjs',
  'scripts/blog-images.mjs','scripts/check-ghost-content.mjs','scripts/ghost-content.sample.json','scripts/validate-blog-output.mjs',
])if(await exists(removed))throw Error(`Removed Blog delivery file still exists: ${removed}.`);

const runtimePaths=[
  ...(await filesBelow('blog')),
  resolve(root,'assets/js/suvarnatantu-blog-api.js'),
  resolve(root,'assets/js/suvarnatantu-blog-list.js'),
  resolve(root,'assets/js/suvarnatantu-blog-detail.js'),
  resolve(root,'assets/js/suvarnatantu-blog-sanitize.js'),
  resolve(root,'assets/css/knowledge-centre.css'),
  resolve(root,'package.json'),
  resolve(root,'package-lock.json'),
  resolve(root,'.github/workflows/firebase-hosting-merge.yml'),
];
const forbidden=/ghost\.io|ghost\.org|suvarnatantu\.ghost\.io|ghost\/api\/content|@tryghost|GHOST_CONTENT_API|storage\.ghost\.io/i;
for(const path of runtimePaths){
  const source=await readFile(path,'utf8');
  if(forbidden.test(source))throw Error(`Blog delivery still references the retired provider: ${relative(root,path)}.`);
}

const workflow=await read('.github/workflows/firebase-hosting-merge.yml');
if(/repository_dispatch|schedule:|force_rebuild/i.test(workflow))throw Error('Deployment workflow retains content-provider rebuild triggers.');
if(!workflow.includes('projectId: suvarnatantu-vastranand')||!workflow.includes('channelId: live'))throw Error('Existing Firebase production deployment settings changed.');

const packageJson=await read('package.json');
if(/sharp|build:blog|test:ghost/i.test(packageJson))throw Error('Package scripts retain retired Blog build dependencies.');
const firebase=await read('firebase.json');
if(hash(firebase)!==expectedFirebaseHash)throw Error('firebase.json changed; this integration must not change Firebase settings.');

const css=await read('assets/css/knowledge-centre.css');
if((css.match(/{/g)||[]).length!==(css.match(/}/g)||[]).length)throw Error('Knowledge Centre CSS has unbalanced braces.');
if(!css.includes(':focus-visible')||!css.includes('overflow-wrap:anywhere'))throw Error('Blog CSS is missing keyboard-focus or overflow protections.');

console.log(`Validated the API Blog runtime, ${legacySlugs.length} legacy routes, provider disconnection, CSS structure, and unchanged Firebase settings.`);
