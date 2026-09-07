import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

export const site='https://suvarnatantu.com';
export const normalizeDate=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString().slice(0,10)};
export const escapeXml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const sourceForUrl=(root,url)=>{if(!url.startsWith(`${site}/`))return null;const path=new URL(url).pathname;const clean=path==='/'?'':path.replace(/^\//,'').replace(/\/$/,'');const candidates=path==='/'?['index.html']:[`${clean}/index.html`,`${clean}.html`];return candidates.find(file=>!file.includes('..')&&existsSync(resolve(root,file)))||null};
export const gitDate=(root,file)=>{if(!file)return null;try{return normalizeDate(execFileSync('git',['log','-1','--format=%cI','--',file],{cwd:root,encoding:'utf8'}).trim())}catch{return null}};
export const latestPostDate=posts=>posts.map(post=>normalizeDate(post.updated_at||post.published_at)).filter(Boolean).sort().at(-1)||null;
export const renderSitemap=entries=>`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(({url,lastmod})=>`  <url>\n    <loc>${escapeXml(url)}</loc>${lastmod?`\n    <lastmod>${lastmod}</lastmod>`:''}\n  </url>`).join('\n')}\n</urlset>\n`;
