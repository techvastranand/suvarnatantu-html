import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {dirname,relative,resolve} from 'node:path';
import sharp from 'sharp';

export const BLOG_IMAGE_WIDTHS = [480, 800, 1200, 1600];
export const BLOG_IMAGE_QUALITY = 82;
export const GENERATED_IMAGE_URL = '/assets/images/blog/generated';
const GHOST_IMAGE_HOST = 'storage.ghost.io';
const FALLBACK_FEATURE_IMAGE = '/assets/images/metallic-zari-spools.webp';

const isGhostImage = value => {
  try { return new URL(value).hostname === GHOST_IMAGE_HOST; }
  catch { return false; }
};

const localFileForUrl = (root, source) => {
  const pathname = decodeURIComponent(source.split(/[?#]/, 1)[0]).replace(/^\/+/, '');
  const file = resolve(root, pathname);
  const pathFromRoot = relative(root, file);
  if (!pathFromRoot || pathFromRoot.startsWith('..') || resolve(root, pathFromRoot) !== file) {
    throw new Error(`Unsafe local Blog image path: ${source}`);
  }
  return file;
};

const loadSource = async (root, source) => {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, {
      headers: {'user-agent': 'Suvarnatantu static Blog image optimizer'},
      redirect: 'follow',
      signal: AbortSignal.timeout(45_000)
    });
    if (!response.ok) throw new Error(`Image request returned ${response.status}: ${source}`);
    return Buffer.from(await response.arrayBuffer());
  }
  if (!source.startsWith('/')) throw new Error(`Unsupported Blog image source: ${source}`);
  return readFile(localFileForUrl(root, source));
};

const orientedWidth = metadata => {
  if (!metadata.width || !metadata.height) throw new Error('Image dimensions could not be read.');
  return metadata.orientation >= 5 && metadata.orientation <= 8 ? metadata.height : metadata.width;
};

const optimizeSource = async ({buffer, source, outputDirectory, publicDirectory, prefix, widths = BLOG_IMAGE_WIDTHS}) => {
  const metadata = await sharp(buffer, {animated: false}).metadata();
  const maximumWidth = orientedWidth(metadata);
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const targetWidths = [...new Set(widths.map(width => Math.min(width, maximumWidth)))].sort((a, b) => a - b);
  const candidates = [];

  await mkdir(outputDirectory, {recursive: true});
  for (const targetWidth of targetWidths) {
    const filename = `${prefix}-${hash}-${targetWidth}.webp`;
    const file = resolve(outputDirectory, filename);
    const output = await sharp(buffer, {animated: false})
      .rotate()
      .resize({width: targetWidth, withoutEnlargement: true})
      .webp({quality: BLOG_IMAGE_QUALITY, effort: 5, smartSubsample: true})
      .toBuffer({resolveWithObject: true});
    const keepOriginalWebp = metadata.format === 'webp'
      && targetWidth === maximumWidth
      && (!metadata.orientation || metadata.orientation === 1)
      && (!metadata.pages || metadata.pages === 1)
      && buffer.length < output.data.length;
    const data = keepOriginalWebp ? buffer : output.data;
    const info = keepOriginalWebp
      ? {width: metadata.width, height: metadata.height, size: buffer.length}
      : output.info;
    await writeFile(file, data);
    candidates.push({
      url: `${publicDirectory}/${filename}`,
      width: info.width,
      height: info.height,
      bytes: info.size
    });
  }

  return {
    source,
    hash,
    originalBytes: buffer.length,
    width: candidates.at(-1).width,
    height: candidates.at(-1).height,
    candidates
  };
};

const attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? match[1] ?? match[2] ?? match[3] : '';
};

const removeImageDeliveryAttributes = tag => tag.replace(
  /\s(?:src|srcset|sizes|width|height|loading|decoding|fetchpriority)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
  ''
);

const htmlAttribute = value => String(value).replace(/[&<>"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
}[character]));

export const chooseCandidate = (image, preferredWidth) =>
  image.candidates.find(candidate => candidate.width >= preferredWidth) || image.candidates.at(-1);

export const imageSrcset = (image, maximumWidth = Infinity) => {
  const candidates = image.candidates.filter(candidate => candidate.width <= maximumWidth);
  const selected = candidates.length ? candidates : [image.candidates[0]];
  return selected.map(candidate => `${candidate.url} ${candidate.width}w`).join(', ');
};

const localizeArticleHtml = async ({html, slug, root, outputDirectory, publicDirectory, sourceCache}) => {
  const source = String(html || '');
  const matches = [...source.matchAll(/<img\b[^>]*>/gi)];
  if (!matches.length) return {html: source, images: [], failures: []};

  let localized = '';
  let cursor = 0;
  const images = [];
  const failures = [];
  for (const [index, match] of matches.entries()) {
    const tag = match[0];
    const imageSource = attribute(tag, 'src').replace(/&amp;/g, '&');
    localized += source.slice(cursor, match.index);
    cursor = match.index + tag.length;
    if (!isGhostImage(imageSource)) {
      localized += tag;
      continue;
    }

    try {
      const buffer = await sourceCache(imageSource);
      const image = await optimizeSource({
        buffer,
        source: imageSource,
        outputDirectory,
        publicDirectory,
        prefix: `body-${String(index + 1).padStart(2, '0')}`,
        widths: BLOG_IMAGE_WIDTHS.filter(width => width <= 1200)
      });
      const fallback = chooseCandidate(image, 800);
      const retained = removeImageDeliveryAttributes(tag).replace(/\s*\/?>(\s*)$/, '');
      localized += `${retained} src="${htmlAttribute(fallback.url)}" srcset="${htmlAttribute(imageSrcset(image, 1200))}" sizes="(max-width: 640px) calc(100vw - 28px), 850px" width="${fallback.width}" height="${fallback.height}" loading="lazy" decoding="async">`;
      images.push(image);
    } catch (error) {
      failures.push({slug, source: imageSource, message: error.message});
      const retained = tag
        .replace(/\s(?:loading|decoding|fetchpriority)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\s*\/?>(\s*)$/, '');
      localized += `${retained} loading="lazy" decoding="async">`;
    }
  }
  localized += source.slice(cursor);
  return {html: localized, images, failures};
};

export async function optimizeBlogImages(posts, {root}) {
  const generatedRoot = resolve(root, 'assets/images/blog/generated');
  const stageRoot = resolve(root, '.cache/blog-generated-images');
  const sourcePromises = new Map();
  const sourceCache = source => {
    if (!sourcePromises.has(source)) sourcePromises.set(source, loadSource(root, source));
    return sourcePromises.get(source);
  };
  const generatedImages = [];
  const failures = [];

  await rm(stageRoot, {recursive: true, force: true});
  await mkdir(stageRoot, {recursive: true});
  try {
    for (const post of posts) {
      const outputDirectory = resolve(stageRoot, post.slug);
      const publicDirectory = `${GENERATED_IMAGE_URL}/${post.slug}`;
      const featureSource = post.feature_image || FALLBACK_FEATURE_IMAGE;
      const featureBuffer = await sourceCache(featureSource);
      const feature = await optimizeSource({
        buffer: featureBuffer,
        source: featureSource,
        outputDirectory,
        publicDirectory,
        prefix: 'feature'
      });
      const body = await localizeArticleHtml({
        html: post.html,
        slug: post.slug,
        root,
        outputDirectory,
        publicDirectory,
        sourceCache
      });
      post.blogFeatureImage = feature;
      post.html = body.html;
      failures.push(...body.failures);
      generatedImages.push({slug: post.slug, feature, body: body.images});
    }

    await mkdir(dirname(generatedRoot), {recursive: true});
    await rm(generatedRoot, {recursive: true, force: true});
    await rename(stageRoot, generatedRoot);
  } catch (error) {
    await rm(stageRoot, {recursive: true, force: true});
    throw error;
  }

  const featureOriginalBytes = generatedImages.reduce((sum, item) => sum + item.feature.originalBytes, 0);
  const featureCardBytes = generatedImages.reduce((sum, item) => sum + chooseCandidate(item.feature, 800).bytes, 0);
  const generatedBytes = generatedImages.reduce((sum, item) => sum + [item.feature, ...item.body].flatMap(image => image.candidates).reduce((total, candidate) => total + candidate.bytes, 0), 0);
  return {
    generatedImages,
    failures,
    stats: {
      featureImages: generatedImages.length,
      bodyImages: generatedImages.reduce((sum, item) => sum + item.body.length, 0),
      featureOriginalBytes,
      featureCardBytes,
      generatedBytes
    }
  };
}
