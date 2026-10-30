import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';
import {
  API_ROOT,
  POLICY_PAGES,
  SiteHelpApiError,
  STATIC_POLICY_PAGES,
  fetchFaqs,
  fetchPolicy,
  parseFaqs,
  parsePolicies,
  parsePolicy,
  policyPath,
  questionAnchor,
  resolvePolicyHandle,
  runtimeApiRoot,
} from '../assets/js/suvarnatantu-site-help-api.js';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const envelope=data=>({message:'ok',data});
const json=(status,body)=>async()=>({ok:status>=200&&status<300,status,json:async()=>body});

test('the API root is the production Engage site-help endpoint for Suvarnatantu only',()=>{
  assert.equal(API_ROOT,'https://api-engage.vastranand.com/v1/public/site-help/suvarnatantu');
  assert.equal(runtimeApiRoot({hostname:'suvarnatantu.com'},'http://localhost:9000/mock'),API_ROOT);
  assert.equal(runtimeApiRoot({hostname:'localhost'},'http://localhost:9000/mock/'),'http://localhost:9000/mock');
});

test('FAQ parsing keeps valid questions and drops empty categories',()=>{
  const categories=parseFaqs(envelope({site:'suvarnatantu',categories:[
    {id:1,name:'Samples',description:'',image_url:'',questions:[{id:3,question:'Can I request a sample?',answer_html:'<p>Yes.</p>',popular:true},{id:4,question:'',answer_html:'<p>x</p>',popular:false}]},
    {id:2,name:'Empty',description:'',image_url:'',questions:[]},
  ]}));
  assert.equal(categories.length,1);
  assert.deepEqual(categories[0].questions.map(question=>question.id),[3]);
  assert.throws(()=>parseFaqs({message:'ok',data:{}}),SiteHelpApiError);
});

test('policy parsing validates handles and bodies',()=>{
  assert.deepEqual(parsePolicies(envelope({policies:[{handle:'sample-policy',title:'Sample Policy',updated_at:'2026-10-30T00:00:00'},{handle:'Bad Handle',title:'x',updated_at:null}]})).map(policy=>policy.handle),['sample-policy']);
  assert.equal(parsePolicy(envelope({handle:'legal-notice',title:'Legal notice',body_html:'<p>Text</p>',updated_at:null})).bodyHtml,'<p>Text</p>');
  assert.throws(()=>parsePolicy(envelope({handle:'legal-notice',title:'Legal notice',body_html:'',updated_at:null})),SiteHelpApiError);
});

test('errors are typed: 404, server error and timeout',async()=>{
  await assert.rejects(fetchPolicy('missing',{fetchImpl:json(404,{})}),{kind:'not-found'});
  await assert.rejects(fetchFaqs({fetchImpl:json(500,{})}),{kind:'unavailable'});
  const hang=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));
  await assert.rejects(fetchFaqs({fetchImpl:hang,timeoutMs:20}),{kind:'timeout'});
  await assert.rejects(fetchPolicy('../etc'),{kind:'invalid-handle'});
});

test('policy links use static pages when they exist and the view page otherwise',()=>{
  assert.equal(policyPath('sample-policy'),'/policies/sample-policy/');
  assert.equal(policyPath('quality-charter'),'/policies/view/?handle=quality-charter');
  assert.equal(resolvePolicyHandle({href:'https://suvarnatantu.com/policies/view/?handle=quality-charter'}),'quality-charter');
  assert.equal(resolvePolicyHandle({href:'https://suvarnatantu.com/policies/view/?handle=..%2Fx'}),null);
  for(const handle of POLICY_PAGES)assert.ok(existsSync(new URL(`policies/${handle}/index.html`,root)),handle);
});

test('FAQ anchors are unique',()=>{
  const taken=new Set();
  assert.equal(questionAnchor('What is TPM?',taken),'what-is-tpm');
  assert.equal(questionAnchor('What is TPM?',taken),'what-is-tpm-2');
});

test('pages use the shared shell and never claim the approved legal pages twice',()=>{
  for(const path of ['faq/index.html','policies/index.html','policies/view/index.html','policies/sample-policy/index.html']){
    const html=read(path);
    assert.ok(html.includes('/assets/js/site-shell.js?v=20260909-2'),path);
    assert.ok(html.includes('id="site-header-mount"'),path);
  }
  assert.ok(read('policies/privacy-policy/index.html').includes('rel="canonical" href="https://suvarnatantu.com/privacy-policy/"'));
  assert.ok(read('policies/terms-of-service/index.html').includes('rel="canonical" href="https://suvarnatantu.com/terms/"'));
  assert.deepEqual(Object.keys(STATIC_POLICY_PAGES).sort(),['privacy-policy','terms-of-service']);
  assert.ok(read('policies/view/index.html').includes('noindex,follow'));
  assert.ok(!read('faq/index.html').includes('noindex'),'FAQ must be indexable when content loads');
  assert.ok(read('assets/js/site-shell.js').includes('suvarnatantu-site-help-links.js'));
});
