import { access, readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const shellVersion = '20260909-2';
const shellReference = `/assets/js/site-shell.js?v=${shellVersion}`;
const excludedDirectories = new Set(['.git', 'node_modules']);

async function exists(path) {
  return access(path).then(() => true, () => false);
}

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) files.push(...await htmlFiles(resolve(directory, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) files.push(resolve(directory, entry.name));
  }
  return files;
}

function menuSignature(source, context) {
  const menu = /<div class="menu" id="site-menu">([\s\S]*?)<\/div>\s*<\/div>\s*<\/nav>/.exec(source)?.[1];
  if (!menu) throw new Error(`${context} is missing the primary menu.`);
  return [...menu.matchAll(/<(a|summary)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map(([, tag, attributes, content]) => {
    const label = content.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const href = tag === 'a' ? /href="([^"]+)"/.exec(attributes)?.[1] : '';
    if (tag === 'a' && !href) throw new Error(`${context} contains a primary-menu anchor without an href.`);
    return `${tag}:${href}:${label}`;
  });
}

const sharedShell = await readFile(resolve(root, 'assets', 'js', 'site-shell.js'), 'utf8');
const sharedSequence = '<a href="/about-us/">About</a><a href="/contact/">Contact</a><a class="navcta" href="/request-quote/">Request Quote</a>';
if (!sharedShell.includes(sharedSequence)) throw new Error('The shared header must keep About, Contact, then navcta Request Quote.');
const headerTemplate = /const header = `([\s\S]*?)`;/m.exec(sharedShell)?.[1];
if (!headerTemplate) throw new Error('The canonical shared header template is missing.');
if ((headerTemplate.match(/href="\/contact\/">Contact<\/a>/g) || []).length !== 1) {
  throw new Error('The canonical shared header must contain Contact exactly once.');
}
if ((headerTemplate.match(/href="\/zari-yarn\/imitation-zari\/">Imitation Zari<\/a>/g) || []).length !== 1) {
  throw new Error('The canonical shared header must contain Imitation Zari exactly once.');
}

for (const [legacy, canonical] of [['products.html', 'products/index.html'], ['blog.html', 'blog/index.html']]) {
  if (await exists(resolve(root, legacy)) && await exists(resolve(root, canonical))) {
    throw new Error(`${legacy} competes with the canonical ${canonical} route source.`);
  }
  if (!await exists(resolve(root, canonical))) throw new Error(`The canonical route source ${canonical} is missing.`);
}

const homepage = await readFile(resolve(root, 'index.html'), 'utf8');
const homepageSequence = '<a class="hoverable" href="/about-us/">About</a>\n      <a class="hoverable" href="/contact/">Contact</a>\n      <a class="navcta hoverable" href="/request-quote/">Request Quote</a>';
if (!homepage.includes(homepageSequence)) throw new Error('The homepage fallback header must keep About, Contact, then navcta Request Quote.');
if ((homepage.match(/href="\/zari-yarn\/imitation-zari\/">Imitation Zari<\/a>/g) || []).length !== 1) {
  throw new Error('The homepage fallback header must contain Imitation Zari exactly once.');
}
if (JSON.stringify(menuSignature(headerTemplate, 'Shared header')) !== JSON.stringify(menuSignature(homepage, 'Homepage fallback header'))) {
  throw new Error('The homepage fallback and canonical shared primary menus must contain the same navigation items in the same order.');
}

const generator = await readFile(resolve(root, 'scripts', 'build-blog.mjs'), 'utf8');
if (!generator.includes(shellReference) || /site-shell\.js\?v=(?!20260909-2)/.test(generator)) {
  throw new Error('The blog generator must use only the current shared-shell version.');
}

const firebase = JSON.parse(await readFile(resolve(root, 'firebase.json'), 'utf8'));
for (const [regex, destination] of [['^/products\\.html/?$', '/products/'], ['^/blog\\.html/?$', '/blog/']]) {
  const redirect = firebase.hosting.redirects?.find(rule => rule.regex === regex);
  if (!redirect || redirect.destination !== destination || redirect.type !== 301) {
    throw new Error(`Firebase Hosting must permanently redirect ${regex} to ${destination}.`);
  }
}
const hasRevalidatingHtmlPolicy = firebase.hosting.headers?.some(rule => rule.source === '!/assets/**' && rule.headers?.some(header => header.key === 'Cache-Control' && header.value === 'no-cache, max-age=0, must-revalidate'));
if (!hasRevalidatingHtmlPolicy) throw new Error('Firebase Hosting must revalidate non-asset page responses.');
const preservesGhostStatePolicy = firebase.hosting.headers?.some(rule => rule.source === '/blog/ghost-state.json' && rule.headers?.some(header => header.key === 'Cache-Control' && header.value === 'no-store, max-age=0'));
if (!preservesGhostStatePolicy) throw new Error('Firebase Hosting must preserve the Ghost-state no-store policy.');

const pages = await htmlFiles(root);
let sharedShellPages = 0;
const canonicalClaims = new Map([
  ['https://suvarnatantu.com/products/', []],
  ['https://suvarnatantu.com/blog/', []]
]);
for (const path of pages) {
  const html = await readFile(path, 'utf8');
  for (const [canonical, claims] of canonicalClaims) {
    if (html.includes(`rel="canonical" href="${canonical}"`)) claims.push(relative(root, path).replaceAll('\\', '/'));
  }
  if (!html.includes('site-shell.js')) continue;
  sharedShellPages += 1;
  const references = [...html.matchAll(/\/assets\/js\/site-shell\.js\?v=([^"'\s<]+)/g)].map(([, version]) => version);
  if (references.length !== 1 || references[0] !== shellVersion) {
    throw new Error(`${relative(root, path)} must reference only ${shellReference}.`);
  }
  const pagePath = relative(root, path);
  if (!['index.html', '404.html'].includes(pagePath) && !html.includes('id="site-header-mount"')) {
    throw new Error(`${pagePath} must provide the shared-header mount.`);
  }
  if (pagePath !== 'index.html' && html.includes('class="site-nav"')) {
    throw new Error(`${pagePath} must not define a competing primary header.`);
  }
}

for (const [canonical, claims] of canonicalClaims) {
  const expected = new URL(canonical).pathname === '/products/' ? 'products/index.html' : 'blog/index.html';
  if (claims.length !== 1 || claims[0] !== expected) {
    throw new Error(`${canonical} must be claimed only by ${expected}; found ${claims.join(', ') || 'no claimant'}.`);
  }
}

if (!sharedShellPages) throw new Error('No public HTML pages reference the shared shell.');
console.log(`Validated shared header order and ${sharedShellPages} current shared-shell HTML references.`);
