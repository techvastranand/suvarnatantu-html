import test from 'node:test';
import assert from 'node:assert/strict';
import {createGhostState, deployedStateUrl, hasGhostChanged, normalizedPosts} from './check-ghost-content.mjs';

const post = {
  id: 'post-1', slug: 'metallic-yarn-guide', title: 'Metallic Yarn Guide', status: 'published',
  published_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
  html: '<p>Useful content.</p>', feature_image: 'https://example.test/image.webp',
  tags: [{id: 'tag-1', name: 'Metallic Yarn', slug: 'metallic-yarn'}]
};

test('same Ghost state is unchanged regardless of input order', () => {
  const second = {...post, id: 'post-2', slug: 'zari-guide'};
  assert.equal(createGhostState([post, second]).fingerprint, createGhostState([second, post]).fingerprint);
  assert.equal(hasGhostChanged(createGhostState([post]), createGhostState([post])), false);
});

test('new published post changes fingerprint', () => {
  assert.equal(hasGhostChanged(createGhostState([post, {...post, id: 'post-2'}]), createGhostState([post])), true);
});

test('edited timestamp or content changes fingerprint', () => {
  assert.notEqual(createGhostState([post]).fingerprint, createGhostState([{...post, updated_at: '2026-09-02T00:00:00.000Z'}]).fingerprint);
  assert.notEqual(createGhostState([post]).fingerprint, createGhostState([{...post, html: '<p>Edited content.</p>'}]).fingerprint);
});

test('unpublished or removed post changes fingerprint', () => {
  assert.equal(hasGhostChanged(createGhostState([]), createGhostState([post])), true);
});

test('missing previous fingerprint requests a safe rebuild', () => {
  assert.equal(hasGhostChanged(createGhostState([post]), null), true);
});

test('tag order is normalized deterministically', () => {
  const tags = [{id: 'b', slug: 'zari-yarn'}, {id: 'a', slug: 'metallic-yarn'}];
  assert.deepEqual(normalizedPosts([{...post, tags}])[0].tags.map(tag => tag.slug), ['metallic-yarn', 'zari-yarn']);
});

test('deployed state lookup receives a unique cache-busting query parameter', () => {
  assert.equal(deployedStateUrl('https://suvarnatantu.com/blog/ghost-state.json', 123), 'https://suvarnatantu.com/blog/ghost-state.json?check=123');
  assert.equal(deployedStateUrl('https://example.test/state?source=workflow', 456), 'https://example.test/state?source=workflow&check=456');
});
