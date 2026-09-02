import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const blogRoot = resolve(root, 'blog');
const requiredCategories = ['metallic-yarn', 'zari-yarn', 'technical-knowledge', 'applications', 'manufacturing', 'export-sourcing', 'industry-insights'];
const contentKey = process.env.GHOST_CONTENT_API_KEY;

if (!contentKey) throw new Error('GHOST_CONTENT_API_KEY is required for the generated-output leak check.');

const read = path => readFile(path, 'utf8');
const requireText = (html, needle, path) => {
  if (!html.includes(needle)) throw new Error(`${path} is missing ${needle}`);
};
const requireOneH1 = (html, path) => {
  if ((html.match(/<h1[ >]/g) || []).length !== 1) throw new Error(`${path} must contain exactly one H1.`);
};

const manifest = JSON.parse(await read(resolve(blogRoot, '.ghost-generated.json')));
if (manifest.version !== 1 || !Array.isArray(manifest.articles)) throw new Error('Invalid Ghost-generated article manifest.');

const homepage = await read(resolve(blogRoot, 'index.html'));
requireText(homepage, 'https://suvarnatantu.com/blog/', 'blog/index.html');
requireOneH1(homepage, 'blog/index.html');

for (const category of requiredCategories) {
  const path = resolve(blogRoot, 'category', category, 'index.html');
  const html = await read(path);
  requireText(html, `https://suvarnatantu.com/blog/category/${category}/`, path);
  requireOneH1(html, path);
}

for (const slug of manifest.articles) {
  const path = resolve(blogRoot, slug, 'index.html');
  const html = await read(path);
  requireText(html, `https://suvarnatantu.com/blog/${slug}/`, path);
  requireText(html, 'property="og:type" content="article"', path);
  requireText(html, 'name="twitter:card"', path);
  requireText(html, 'application/ld+json', path);
  requireText(html, 'kc-prose', path);
  requireOneH1(html, path);
  if (html.includes(contentKey)) throw new Error(`${path} contains the Ghost Content API key.`);
}

const browserFiles = [resolve(root, 'assets', 'js', 'site-shell.js'), resolve(root, 'assets', 'js', 'site-shell-links.js')];
for (const path of browserFiles) {
  const source = await read(path);
  if (source.includes(contentKey) || source.includes('ghost/api/content')) throw new Error(`${path} exposes Ghost API access.`);
}

console.log(`Validated blog homepage, ${manifest.articles.length} article pages, and ${requiredCategories.length} category pages.`);
