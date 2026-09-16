import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {chooseCandidate,imageSrcset,optimizeBlogImages} from './blog-images.mjs';

test('Blog images are fingerprinted, responsive, localized, and never upscaled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'suvarnatantu-blog-images-'));
  const originalFetch = globalThis.fetch;
  try {
    const firstImage = await sharp({
      create: {width: 1000, height: 625, channels: 3, background: '#b78b34'}
    }).png().toBuffer();
    globalThis.fetch = async () => new Response(firstImage, {status: 200, headers: {'content-type': 'image/png'}});

    const posts = [{
      slug: 'image-pipeline-test',
      feature_image: 'https://storage.ghost.io/feature.png',
      html: '<figure><a href="/sample/"><img src="https://storage.ghost.io/body.png" alt="Gold yarn" aria-describedby="caption-one"></a><figcaption id="caption-one">Original caption</figcaption></figure>'
    }];
    const first = await optimizeBlogImages(posts, {root});
    const feature = first.generatedImages[0].feature;

    assert.deepEqual(feature.candidates.map(candidate => candidate.width), [480, 800, 1000]);
    assert.equal(chooseCandidate(feature, 800).width, 800);
    assert.match(imageSrcset(feature, 1200), /480w, .*800w, .*1000w/);
    assert.equal(first.stats.featureImages, 1);
    assert.equal(first.stats.bodyImages, 1);
    assert.match(posts[0].html, /<figure>/);
    assert.match(posts[0].html, /<a href="\/sample\/">/);
    assert.match(posts[0].html, /alt="Gold yarn"/);
    assert.match(posts[0].html, /aria-describedby="caption-one"/);
    assert.match(posts[0].html, /<figcaption id="caption-one">Original caption<\/figcaption>/);
    assert.match(posts[0].html, /srcset="[^"]+"/);
    assert.match(posts[0].html, /loading="lazy" decoding="async"/);

    const firstFiles = await readdir(join(root, 'assets/images/blog/generated/image-pipeline-test'));
    assert.ok(firstFiles.every(file => file.endsWith('.webp')));
    const sample = await sharp(await readFile(join(root, 'assets/images/blog/generated/image-pipeline-test', firstFiles[0]))).metadata();
    assert.equal(sample.format, 'webp');

    const secondImage = await sharp({
      create: {width: 640, height: 400, channels: 3, background: '#76551f'}
    }).png().toBuffer();
    globalThis.fetch = async () => new Response(secondImage, {status: 200, headers: {'content-type': 'image/png'}});
    const changedPosts = [{slug: 'image-pipeline-test', feature_image: 'https://storage.ghost.io/feature.png', html: ''}];
    const second = await optimizeBlogImages(changedPosts, {root});
    const secondFiles = await readdir(join(root, 'assets/images/blog/generated/image-pipeline-test'));
    assert.deepEqual(second.generatedImages[0].feature.candidates.map(candidate => candidate.width), [480, 640]);
    assert.ok(secondFiles.every(file => !firstFiles.includes(file)), 'obsolete fingerprinted assets should be removed');
  } finally {
    globalThis.fetch = originalFetch;
    await rm(root, {recursive: true, force: true});
  }
});
