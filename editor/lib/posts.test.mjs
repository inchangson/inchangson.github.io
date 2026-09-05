import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPostStore, parsePostFile, serializePostFile, validateSlug } from './posts.mjs';

const metadata = {
  title: '테스트 글',
  description: '설명',
  pubDate: '2026-08-11',
  updatedDate: '',
  category: 'backend',
  subcategory: '',
  tags: ['backend', 'test'],
  series: '',
  seriesOrder: undefined,
  seriesLabel: '',
  draft: true,
};

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'blog-editor-'));
  await mkdir(path.join(root, 'src/content/posts'), { recursive: true });
  return { root, store: createPostStore(root) };
}

test('frontmatter와 Markdown 본문을 직렬화하고 다시 읽는다', () => {
  const body = '# 제목\n\n```mermaid\ngraph TD\n```\n\n<details>\n<summary>내용</summary>\n\n원문\n\n</details>\n';
  const source = serializePostFile(metadata, body);
  const parsed = parsePostFile(source);
  assert.deepEqual(parsed.metadata, metadata);
  assert.equal(parsed.body, body);
});

test('slug 경로 탈출과 잘못된 문자를 거부한다', () => {
  assert.throws(() => validateSlug('../secret'));
  assert.throws(() => validateSlug('한글-slug'));
  assert.equal(validateSlug('valid-post-2'), 'valid-post-2');
});

test('카테고리와 시리즈 순서를 검증한다', () => {
  assert.throws(() => serializePostFile({ ...metadata, category: '' }, '본문'), /카테고리/);
  assert.throws(() => serializePostFile({ ...metadata, series: 'test-series', seriesOrder: -1 }, '본문'), /시리즈 순서/);
  assert.throws(() => serializePostFile({ ...metadata, series: '', seriesOrder: 1 }, '본문'), /시리즈를 먼저/);
});

test('글 생성, 조회, 수정과 revision 충돌을 처리한다', async () => {
  const { root, store } = await fixture();
  const created = await store.createPost({ slug: 'test-post', metadata, body: '본문\n' });
  assert.equal(created.body, '본문\n');
  assert.equal((await store.listPosts())[0].slug, 'test-post');

  const updated = await store.updatePost('test-post', {
    metadata: { ...metadata, draft: false },
    body: '수정 본문\n',
    revision: created.revision,
  });
  assert.equal(updated.metadata.draft, false);
  assert.equal(updated.body, '수정 본문\n');

  await assert.rejects(
    store.updatePost('test-post', { metadata, body: '충돌', revision: created.revision }),
    /외부에서 변경/,
  );
  const stored = await readFile(path.join(root, 'src/content/posts/test-post.md'), 'utf8');
  assert.match(stored, /수정 본문/);
});

test('외부에서 변경된 파일의 revision을 거부한다', async () => {
  const { root, store } = await fixture();
  const created = await store.createPost({ slug: 'external-change', metadata, body: '원본\n' });
  const target = path.join(root, 'src/content/posts/external-change.md');
  await writeFile(target, `${await readFile(target, 'utf8')}외부 변경\n`);
  await stat(target);
  await assert.rejects(
    store.updatePost('external-change', { metadata, body: '덮어쓰기', revision: created.revision }),
    /외부에서 변경/,
  );
});

test('이미지 형식과 크기를 검사하고 public 경로에 저장한다', async () => {
  const { store } = await fixture();
  const saved = await store.saveImage('test-post', {
    name: '화면 캡처.png',
    type: 'image/png',
    data: Buffer.from('png-data').toString('base64'),
  });
  assert.match(saved.url, /^\/images\/posts\/test-post\//);
  await assert.rejects(
    store.saveImage('test-post', { name: 'x.svg', type: 'image/svg+xml', data: 'eA==' }),
    /이미지만/,
  );
});

test('저장소의 기존 글을 모두 손실 없이 parse/serialize할 수 있다', async () => {
  const postsDir = path.resolve('src/content/posts');
  const names = (await readdir(postsDir)).filter((name) => name.endsWith('.md'));
  assert.ok(names.length > 0);
  for (const name of names) {
    const source = await readFile(path.join(postsDir, name), 'utf8');
    const first = parsePostFile(source);
    const second = parsePostFile(serializePostFile(first.metadata, first.body));
    assert.deepEqual(second, first, name);
  }
});

test('Kubernetes 글의 여러 줄 코드는 fenced block으로 직렬화된다', async () => {
  for (const slug of ['k8s-study-01-init', 'k8s-study-01-pod', 'k8s-study-01-svc']) {
    const source = await readFile(path.resolve(`src/content/posts/${slug}.md`), 'utf8');
    const parsed = parsePostFile(source);
    assert.match(parsed.body, /```(?:bash|yaml|text)\n[\s\S]+?\n```/, slug);
    assert.doesNotMatch(parsed.body, /`[^`\n]{100,}`/, slug);
    const roundTrip = parsePostFile(serializePostFile(parsed.metadata, parsed.body));
    assert.equal(roundTrip.body, parsed.body, slug);
  }
});
