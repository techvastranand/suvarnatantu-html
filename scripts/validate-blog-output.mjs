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
const articleSchema = (html, path) => {
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, source]) => JSON.parse(source));
  const article = schemas.find(schema => schema['@type'] === 'Article');
  if (!article) throw new Error(`${path} is missing Article schema.`);
  return article;
};
const teamAuthor = name => /^(?:suvarnatantu(?:\s+technical\s+team)?|technical\s+team)$/i.test(String(name || '').trim().replace(/\s+/g, ' '));
const requireResponsiveCards = (html, path) => {
  for (const [tag] of html.matchAll(/<img\b[^>]*data-blog-card-image[^>]*>/g)) {
    for (const expected of ['/assets/images/blog/generated/', 'srcset=', 'sizes=', 'width=', 'height=', 'loading="lazy"', 'decoding="async"', 'fetchpriority="low"']) {
      requireText(tag, expected, path);
    }
    if (tag.includes('storage.ghost.io')) throw new Error(`${path} contains a remote Ghost feature image.`);
  }
};
const requireResponsiveHero = (html, path) => {
  const tag = html.match(/<img class="kc-article__image"[^>]*>/)?.[0];
  if (!tag) throw new Error(`${path} is missing its article hero image.`);
  for (const expected of ['/assets/images/blog/generated/', 'srcset=', 'sizes=', 'width=', 'height=', 'loading="eager"', 'decoding="async"', 'fetchpriority="high"']) {
    requireText(tag, expected, path);
  }
  if (tag.includes('storage.ghost.io')) throw new Error(`${path} contains a remote Ghost feature image.`);
};
const requireGhostHintsForRemoteImages = (html, path) => {
  const remoteImage = [...html.matchAll(/<img\b[^>]*>/g)].some(([tag]) => tag.includes('storage.ghost.io'));
  if (!remoteImage) return;
  requireText(html, '<link rel="preconnect" href="https://storage.ghost.io" crossorigin>', path);
  requireText(html, '<link rel="dns-prefetch" href="//storage.ghost.io">', path);
};

const manifest = JSON.parse(await read(resolve(blogRoot, '.ghost-generated.json')));
if (manifest.version !== 2 || !Array.isArray(manifest.articles) || !Array.isArray(manifest.generatedImages)) throw new Error('Invalid Ghost-generated article manifest.');
if (manifest.generatedImages.length !== manifest.articles.length) throw new Error('Generated Blog image manifest is incomplete.');
for (const item of manifest.generatedImages) {
  if (!manifest.articles.includes(item.slug) || !item.feature?.hash || !Array.isArray(item.feature.candidates) || !item.feature.candidates.length || !Array.isArray(item.body)) {
    throw new Error(`Invalid generated Blog image entry for ${item.slug || 'unknown slug'}.`);
  }
  for (const image of [item.feature, ...item.body]) {
    for (const candidate of image.candidates) {
      if (!candidate.url.startsWith(`/assets/images/blog/generated/${item.slug}/`) || !candidate.url.endsWith('.webp') || !candidate.width || !candidate.height || !candidate.bytes) {
        throw new Error(`Invalid generated image candidate for ${item.slug}.`);
      }
      await read(resolve(root, candidate.url.replace(/^\//, '')));
    }
  }
}
const ghostState = JSON.parse(await read(resolve(blogRoot, 'ghost-state.json')));
if (ghostState.version !== 1 || ghostState.algorithm !== 'sha256' || !/^[a-f0-9]{64}$/.test(ghostState.fingerprint)) {
  throw new Error('Invalid deployed Ghost content fingerprint.');
}

const homepage = await read(resolve(blogRoot, 'index.html'));
requireText(homepage, 'https://suvarnatantu.com/blog/', 'blog/index.html');
requireText(homepage, 'href="/blog/articles/"', 'blog/index.html');
requireOneH1(homepage, 'blog/index.html');
requireResponsiveCards(homepage, 'blog/index.html');
requireGhostHintsForRemoteImages(homepage, 'blog/index.html');

const articles = await read(resolve(blogRoot, 'articles', 'index.html'));
requireText(articles, 'https://suvarnatantu.com/blog/articles/', 'blog/articles/index.html');
requireOneH1(articles, 'blog/articles/index.html');
requireResponsiveCards(articles, 'blog/articles/index.html');
requireGhostHintsForRemoteImages(articles, 'blog/articles/index.html');

for (const category of requiredCategories) {
  const path = resolve(blogRoot, 'category', category, 'index.html');
  const html = await read(path);
  requireText(html, `https://suvarnatantu.com/blog/category/${category}/`, path);
  requireOneH1(html, path);
  requireResponsiveCards(html, path);
  requireGhostHintsForRemoteImages(html, path);
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
  requireResponsiveHero(html, path);
  requireResponsiveCards(html, path);
  requireGhostHintsForRemoteImages(html, path);
  const schema = articleSchema(html, path);
  if (!schema.author) throw new Error(`${path} is missing an Article author.`);
  if (!schema.publisher || schema.publisher['@id'] !== 'https://suvarnatantu.com/#organization') throw new Error(`${path} must reference the canonical publisher.`);
  const byline = html.match(/<div class="kc-meta">By ([\s\S]*?) · /)?.[1];
  const schemaName = schema.author.name || (schema.author['@id'] === 'https://suvarnatantu.com/#organization' ? byline : '');
  if (!byline || schemaName !== byline) throw new Error(`${path} has an inconsistent visible byline and schema author.`);
  if (teamAuthor(byline)) {
    if (schema.author['@type'] === 'Person') throw new Error(`${path} must not classify a team author as Person.`);
  } else if (schema.author['@type'] !== 'Person') throw new Error(`${path} must classify a named author as Person.`);
  if (/"email"\s*:/i.test(JSON.stringify(schema.author))) throw new Error(`${path} exposes private author information.`);
  const relatedSection = html.match(/<div class="eyebrow">Related articles<\/div>[\s\S]*?<\/section>/)?.[0] || '';
  const relatedUrls = [...relatedSection.matchAll(/<article class="kc-card"><a[^>]+href="(\/blog\/[^"/]+\/)"/g)].map(([, url]) => url);
  if (new Set(relatedUrls).size !== relatedUrls.length) throw new Error(`${path} contains duplicate related article URLs.`);
  if (relatedUrls.includes(`/blog/${slug}/`)) throw new Error(`${path} links to itself in related articles.`);
  if (slug.includes('tpm')) { requireText(html, 'Related technical resources', path); requireText(html, 'href="/zari-lab/tpm/"', path); requireText(html, 'href="/specifications/yarn-tpm-guide/"', path); }
  if (slug.includes('denier')) { requireText(html, 'Related technical resources', path); requireText(html, 'href="/zari-lab/denier/"', path); requireText(html, 'href="/specifications/yarn-denier-guide/"', path); }
  if (html.includes(contentKey)) throw new Error(`${path} contains the Ghost Content API key.`);
}

const browserFiles = [resolve(root, 'assets', 'js', 'site-shell.js'), resolve(root, 'assets', 'js', 'site-shell-links.js')];
for (const path of browserFiles) {
  const source = await read(path);
  if (source.includes(contentKey) || source.includes('ghost/api/content')) throw new Error(`${path} exposes Ghost API access.`);
}

console.log(`Validated blog homepage, ${manifest.articles.length} article pages, and ${requiredCategories.length} category pages.`);
