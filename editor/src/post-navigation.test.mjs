import assert from 'node:assert/strict';
import test from 'node:test';
import { POST_VIEWS, filterPosts, groupPosts, resolveInitialPostSlug } from './post-navigation.js';

const posts = [
  { slug: 'latest', title: '최신', description: '', pubDate: '2026-08-30', category: 'ops', tags: [], series: '', seriesOrder: undefined },
  { slug: 'second', title: '둘째', description: '검색 대상', pubDate: '2026-08-20', category: 'backend', tags: ['java'], series: 'concurrency', seriesOrder: 2 },
  { slug: 'first', title: '첫째', description: '', pubDate: '2026-08-10', category: 'backend', tags: [], series: 'concurrency', seriesOrder: 1 },
];
const series = [{ id: 'concurrency', title: '동시성' }];

test('저장된 글이 있으면 복원하고 없으면 최신 글을 고른다', () => {
  assert.equal(resolveInitialPostSlug(posts, 'second'), 'second');
  assert.equal(resolveInitialPostSlug(posts, 'deleted'), 'latest');
  assert.equal(resolveInitialPostSlug([], 'second'), null);
});

test('검색은 제목, 설명, slug, 카테고리와 태그를 대상으로 한다', () => {
  assert.deepEqual(filterPosts(posts, '검색').map((post) => post.slug), ['second']);
  assert.deepEqual(filterPosts(posts, 'java').map((post) => post.slug), ['second']);
  assert.deepEqual(filterPosts(posts, 'BACKEND').map((post) => post.slug), ['second', 'first']);
});

test('시리즈는 제목과 순서로 묶고 미지정 그룹을 마지막에 둔다', () => {
  const groups = groupPosts(posts, POST_VIEWS.series, series);
  assert.deepEqual(groups.map((group) => group.label), ['동시성', '시리즈 없음']);
  assert.deepEqual(groups[0].posts.map((post) => post.slug), ['first', 'second']);
});

test('카테고리는 이름순, 글은 발행일순으로 묶는다', () => {
  const groups = groupPosts(posts, POST_VIEWS.category, series);
  assert.deepEqual(groups.map((group) => group.label), ['backend', 'ops']);
  assert.deepEqual(groups[0].posts.map((post) => post.slug), ['second', 'first']);
});
