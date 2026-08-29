import { Buffer } from 'node:buffer';
import { mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n(?:\r?\n)?|$)/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export class PostStoreError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'PostStoreError';
    this.status = status;
  }
}

export function validateSlug(slug) {
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    throw new PostStoreError(400, 'slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
  }
  return slug;
}

export function parsePostFile(source) {
  const match = source.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new PostStoreError(422, '유효한 YAML frontmatter를 찾을 수 없습니다.');
  }

  const parsed = parseYaml(match[1]);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PostStoreError(422, 'frontmatter가 객체 형식이 아닙니다.');
  }

  return {
    metadata: normalizeMetadata(parsed),
    body: source.slice(match[0].length),
  };
}

export function serializePostFile(metadata, body) {
  const normalized = normalizeMetadata(metadata, true);
  const ordered = {
    title: normalized.title,
    description: normalized.description,
    pubDate: normalized.pubDate,
  };

  if (normalized.updatedDate) ordered.updatedDate = normalized.updatedDate;
  ordered.tags = normalized.tags;
  if (normalized.draft) ordered.draft = true;

  const frontmatter = stringifyYaml(ordered, { lineWidth: 0 }).trimEnd();
  return `---\n${frontmatter}\n---\n\n${String(body ?? '').replace(/^\s*\n/, '')}`;
}

export function normalizeMetadata(value, strict = false) {
  const title = stringValue(value.title);
  const description = stringValue(value.description);
  const pubDate = dateValue(value.pubDate);
  const updatedDate = dateValue(value.updatedDate, true);
  const tags = Array.isArray(value.tags)
    ? [...new Set(value.tags.map(stringValue).filter(Boolean))]
    : [];
  const draft = value.draft === true;

  if (strict && (!title || !description || !pubDate)) {
    throw new PostStoreError(400, '제목, 설명, 발행일은 필수입니다.');
  }

  return { title, description, pubDate, updatedDate, tags, draft };
}

function stringValue(value) {
  return value == null ? '' : String(value).trim();
}

function dateValue(value, optional = false) {
  if (value == null || value === '') return optional ? '' : '';
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new PostStoreError(400, `올바르지 않은 날짜입니다: ${text}`);
  }
  return text;
}

function revisionFor(fileStat) {
  return `${fileStat.mtimeMs}:${fileStat.size}`;
}

function assertRooted(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new PostStoreError(400, '허용되지 않은 파일 경로입니다.');
  }
}

export function createPostStore(rootDir) {
  const postsDir = path.resolve(rootDir, 'src/content/posts');
  const publicDir = path.resolve(rootDir, 'public');

  const postPath = (slug) => {
    validateSlug(slug);
    const target = path.join(postsDir, `${slug}.md`);
    assertRooted(postsDir, target);
    return target;
  };

  async function readPost(slug) {
    const target = postPath(slug);
    try {
      const [source, fileStat] = await Promise.all([readFile(target, 'utf8'), stat(target)]);
      return { slug, ...parsePostFile(source), revision: revisionFor(fileStat) };
    } catch (error) {
      if (error?.code === 'ENOENT') throw new PostStoreError(404, '글을 찾을 수 없습니다.');
      throw error;
    }
  }

  async function listPosts() {
    const entries = await readdir(postsDir, { withFileTypes: true });
    const posts = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map(async (entry) => {
          const slug = entry.name.slice(0, -3);
          const post = await readPost(slug);
          return { slug, ...post.metadata, revision: post.revision };
        }),
    );
    return posts.sort((a, b) => b.pubDate.localeCompare(a.pubDate) || a.title.localeCompare(b.title, 'ko'));
  }

  async function createPost({ slug, metadata, body }) {
    const target = postPath(slug);
    const source = serializePostFile(metadata, body);
    await mkdir(postsDir, { recursive: true });
    try {
      const handle = await open(target, 'wx');
      try {
        await handle.writeFile(source, 'utf8');
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (error?.code === 'EEXIST') throw new PostStoreError(409, '이미 사용 중인 slug입니다.');
      throw error;
    }
    return readPost(slug);
  }

  async function updatePost(slug, { metadata, body, revision }) {
    const target = postPath(slug);
    let currentStat;
    try {
      currentStat = await stat(target);
    } catch (error) {
      if (error?.code === 'ENOENT') throw new PostStoreError(404, '글을 찾을 수 없습니다.');
      throw error;
    }
    if (!revision || revision !== revisionFor(currentStat)) {
      throw new PostStoreError(409, '파일이 외부에서 변경되었습니다. 새로고침 후 다시 편집해 주세요.');
    }

    const temporary = path.join(postsDir, `.${slug}.${process.pid}.${Date.now()}.tmp`);
    assertRooted(postsDir, temporary);
    try {
      await writeFile(temporary, serializePostFile(metadata, body), { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    }
    return readPost(slug);
  }

  async function saveImage(slug, { name, type, data }) {
    validateSlug(slug);
    const extension = IMAGE_TYPES.get(type);
    if (!extension) throw new PostStoreError(415, 'PNG, JPEG, WebP, GIF 이미지만 사용할 수 있습니다.');
    if (typeof data !== 'string') throw new PostStoreError(400, '이미지 데이터가 없습니다.');

    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      throw new PostStoreError(413, '이미지는 10MB 이하여야 합니다.');
    }

    const assetDir = path.join(publicDir, 'images', 'posts', slug);
    assertRooted(publicDir, assetDir);
    await mkdir(assetDir, { recursive: true });
    const base = path.basename(name || 'image', path.extname(name || ''))
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9가-힣_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image';
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

    for (let index = 0; index < 100; index += 1) {
      const suffix = index ? `-${index}` : '';
      const filename = `${stamp}-${base}${suffix}${extension}`;
      const target = path.join(assetDir, filename);
      assertRooted(assetDir, target);
      try {
        const handle = await open(target, 'wx');
        try {
          await handle.writeFile(buffer);
        } finally {
          await handle.close();
        }
        return { url: `/images/posts/${slug}/${encodeURIComponent(filename)}` };
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
      }
    }
    throw new PostStoreError(409, '이미지 파일 이름 충돌을 해결할 수 없습니다.');
  }

  return { listPosts, readPost, createPost, updatePost, saveImage };
}
