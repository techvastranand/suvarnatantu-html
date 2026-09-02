import {appendFile, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outputFile = resolve(root, 'blog', 'ghost-state.json');

const cleanTag = tag => ({
  id: tag?.id || '',
  name: tag?.name || '',
  slug: tag?.slug || ''
});

export function normalizedPosts(posts) {
  if (!Array.isArray(posts)) throw new Error('Ghost response does not contain a posts array.');
  return posts.map(post => ({
    id: post.id || '',
    slug: post.slug || '',
    title: post.title || '',
    status: post.status || 'published',
    published_at: post.published_at || '',
    updated_at: post.updated_at || '',
    custom_excerpt: post.custom_excerpt || '',
    excerpt: post.excerpt || '',
    feature_image: post.feature_image || '',
    feature_image_alt: post.feature_image_alt || '',
    html: post.html || '',
    primary_tag: cleanTag(post.primary_tag),
    tags: (post.tags || []).map(cleanTag).sort((a, b) => a.slug.localeCompare(b.slug) || a.id.localeCompare(b.id))
  })).sort((a, b) => a.id.localeCompare(b.id) || a.slug.localeCompare(b.slug));
}

export function createGhostState(posts) {
  const normalized = normalizedPosts(posts);
  const fingerprint = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  return {version: 1, algorithm: 'sha256', fingerprint, postCount: normalized.length};
}

export function hasGhostChanged(current, deployed) {
  return !deployed || deployed.version !== 1 || deployed.algorithm !== 'sha256' || deployed.fingerprint !== current.fingerprint;
}

export function deployedStateUrl(stateUrl, timestamp = Date.now()) {
  const separator = stateUrl.includes('?') ? '&' : '?';
  return `${stateUrl}${separator}check=${timestamp}`;
}

async function fetchGhostPosts() {
  const url = process.env.GHOST_CONTENT_API_URL?.replace(/\/$/, '');
  const key = process.env.GHOST_CONTENT_API_KEY;
  if (!url || !key) throw new Error('GHOST_CONTENT_API_URL and GHOST_CONTENT_API_KEY are required.');
  const endpoint = `${url}/ghost/api/content/posts/?key=${encodeURIComponent(key)}&include=tags&limit=all&formats=html`;
  const response = await fetch(endpoint, {headers: {'Accept': 'application/json'}});
  if (!response.ok) throw new Error(`Ghost Content API returned ${response.status}.`);
  return (await response.json()).posts;
}

async function readDeployedState() {
  if (process.env.GHOST_DEPLOYED_STATE_FILE) {
    try { return JSON.parse(await readFile(resolve(process.env.GHOST_DEPLOYED_STATE_FILE), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  const stateUrl = process.env.GHOST_DEPLOYED_STATE_URL || 'https://suvarnatantu.com/blog/ghost-state.json';
  const response = await fetch(deployedStateUrl(stateUrl), {
    cache: 'no-store',
    headers: {'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache'}
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Deployed Ghost state returned ${response.status}.`);
  try { return await response.json(); }
  catch { return null; }
}

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
  const posts = await fetchGhostPosts();
  const current = createGhostState(posts);
  const deployed = process.env.GHOST_FORCE_REBUILD === 'true' ? null : await readDeployedState();
  const changed = hasGhostChanged(current, deployed);
  await writeFile(outputFile, `${JSON.stringify(current, null, 2)}\n`);
  await setOutput('changed', String(changed));
  await setOutput('fingerprint', current.fingerprint);
  await setOutput('post_count', String(current.postCount));
  console.log(changed ? `Ghost content change detected (${current.postCount} published posts).` : 'No Ghost content changes detected.');
}

if (resolve(process.argv[1] || '') === resolve(import.meta.filename)) main().catch(error => {
  console.error(`Ghost content check failed: ${error.message}`);
  process.exitCode = 1;
});
