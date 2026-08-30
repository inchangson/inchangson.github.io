import { mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PostStoreError, validateSlug } from './posts.mjs';

const revisionFor = (fileStat) => `${fileStat.mtimeMs}:${fileStat.size}`;

async function atomicJsonUpdate(target, value) {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

function validateResume(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PostStoreError(400, 'Resume 데이터가 올바르지 않습니다.');
  const profile = value.profile;
  if (!profile || !String(profile.name || '').trim() || !String(profile.description || '').trim()) {
    throw new PostStoreError(400, 'Resume 이름과 소개는 필수입니다.');
  }
  if (!Array.isArray(value.sections)) throw new PostStoreError(400, 'Resume 섹션 형식이 올바르지 않습니다.');
  const allowed = new Set(['prose', 'timeline', 'list', 'keyValue']);
  for (const section of value.sections) {
    if (!section || !allowed.has(section.type) || !String(section.title || '').trim()) {
      throw new PostStoreError(400, 'Resume 섹션의 형식과 제목을 확인해 주세요.');
    }
  }
  return value;
}

export function createDocumentStore(rootDir) {
  const resumePath = path.resolve(rootDir, 'src/data/resume.json');
  const seriesDir = path.resolve(rootDir, 'src/content/series');

  async function readResume() {
    const [source, fileStat] = await Promise.all([readFile(resumePath, 'utf8'), stat(resumePath)]);
    return { data: validateResume(JSON.parse(source)), revision: revisionFor(fileStat) };
  }

  async function updateResume({ data, revision }) {
    const current = await stat(resumePath);
    if (!revision || revision !== revisionFor(current)) throw new PostStoreError(409, 'Resume가 외부에서 변경되었습니다. 새로고침해 주세요.');
    await atomicJsonUpdate(resumePath, validateResume(data));
    return readResume();
  }

  const seriesPath = (id) => path.join(seriesDir, `${validateSlug(id)}.json`);
  async function readSeries(id) {
    const target = seriesPath(id);
    try {
      const [source, fileStat] = await Promise.all([readFile(target, 'utf8'), stat(target)]);
      return { id, ...JSON.parse(source), revision: revisionFor(fileStat) };
    } catch (error) {
      if (error?.code === 'ENOENT') throw new PostStoreError(404, '시리즈를 찾을 수 없습니다.');
      throw error;
    }
  }
  async function listSeries() {
    await mkdir(seriesDir, { recursive: true });
    const names = (await readdir(seriesDir)).filter((name) => name.endsWith('.json'));
    return Promise.all(names.map((name) => readSeries(name.slice(0, -5))));
  }
  function normalizeSeries(value) {
    const title = String(value?.title || '').trim();
    const description = String(value?.description || '').trim();
    if (!title || !description) throw new PostStoreError(400, '시리즈 이름과 설명은 필수입니다.');
    return { title, description };
  }
  async function createSeries({ id, title, description }) {
    const target = seriesPath(id);
    await mkdir(seriesDir, { recursive: true });
    const handle = await open(target, 'wx').catch((error) => {
      if (error?.code === 'EEXIST') throw new PostStoreError(409, '이미 사용 중인 시리즈 ID입니다.');
      throw error;
    });
    try {
      await handle.writeFile(`${JSON.stringify(normalizeSeries({ title, description }), null, 2)}\n`);
    } finally {
      await handle.close();
    }
    return readSeries(id);
  }
  async function updateSeries(id, { title, description, revision }) {
    const target = seriesPath(id);
    const current = await stat(target);
    if (!revision || revision !== revisionFor(current)) throw new PostStoreError(409, '시리즈가 외부에서 변경되었습니다. 새로고침해 주세요.');
    await atomicJsonUpdate(target, normalizeSeries({ title, description }));
    return readSeries(id);
  }
  async function deleteSeries(id, posts) {
    if (posts.some((post) => post.series === id)) throw new PostStoreError(409, '사용 중인 시리즈는 삭제할 수 없습니다.');
    await unlink(seriesPath(id));
  }

  return { readResume, updateResume, listSeries, createSeries, updateSeries, deleteSeries };
}
