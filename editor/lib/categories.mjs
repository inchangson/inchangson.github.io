import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PostStoreError } from './posts.mjs';

const revisionFor = (value) => `${value.mtimeMs}:${value.size}`;
const clean = (value) => String(value || '').trim();

function normalize(data) {
  if (!Array.isArray(data)) throw new PostStoreError(400, '카테고리 데이터 형식이 올바르지 않습니다.');
  const names = new Set();
  return data.map((item) => {
    const name = clean(item?.name);
    if (!name) throw new PostStoreError(400, '카테고리 이름은 필수입니다.');
    if (names.has(name)) throw new PostStoreError(409, '같은 이름의 카테고리가 있습니다.');
    names.add(name);
    const children = new Set();
    const subcategories = (item.subcategories || []).map(clean).filter(Boolean);
    for (const child of subcategories) {
      if (children.has(child)) throw new PostStoreError(409, `${name}에 같은 이름의 하위 카테고리가 있습니다.`);
      children.add(child);
    }
    return { name, subcategories };
  });
}

export function createCategoryStore(rootDir) {
  const target = path.resolve(rootDir, 'src/data/categories.json');
  async function read() {
    try {
      const [source, info] = await Promise.all([readFile(target, 'utf8'), stat(target)]);
      return { categories: normalize(JSON.parse(source)), revision: revisionFor(info) };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await mkdir(path.dirname(target), { recursive: true });
      const handle = await open(target, 'wx');
      await handle.writeFile('[]\n'); await handle.close();
      return read();
    }
  }
  async function update({ categories, revision }) {
    const info = await stat(target);
    if (!revision || revision !== revisionFor(info)) throw new PostStoreError(409, '카테고리가 외부에서 변경되었습니다. 새로고침해 주세요.');
    const value = normalize(categories);
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
      await rename(temporary, target);
    } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
    return read();
  }
  return { read, update };
}
