import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDocumentStore } from './documents.mjs';

const resume = {
  profile: { eyebrow: 'Resume', name: '테스트', description: '소개', contacts: [] },
  sections: [
    { type: 'prose', title: '요약', paragraphs: ['내용'] },
    { type: 'timeline', title: '경력', groups: [] },
    { type: 'list', title: '목록', items: [] },
    { type: 'keyValue', title: '기술', rows: [] },
  ],
};

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'document-editor-'));
  await mkdir(path.join(root, 'src/data'), { recursive: true });
  await mkdir(path.join(root, 'src/content/series'), { recursive: true });
  await writeFile(path.join(root, 'src/data/resume.json'), `${JSON.stringify(resume)}\n`);
  return createDocumentStore(root);
}

test('Resume 네 가지 섹션을 읽고 revision을 확인해 수정한다', async () => {
  const store = await fixture();
  const current = await store.readResume();
  assert.equal(current.data.sections.length, 4);
  const saved = await store.updateResume({ data: { ...current.data, profile: { ...current.data.profile, name: '수정' } }, revision: current.revision });
  assert.equal(saved.data.profile.name, '수정');
  await assert.rejects(store.updateResume({ data: resume, revision: current.revision }), /외부에서 변경/);
});

test('시리즈를 생성·수정하고 사용 중 삭제를 거부한다', async () => {
  const store = await fixture();
  const created = await store.createSeries({ id: 'test-series', title: '테스트', description: '설명' });
  assert.equal((await store.listSeries())[0].id, 'test-series');
  const updated = await store.updateSeries('test-series', { title: '수정', description: '설명', revision: created.revision });
  assert.equal(updated.title, '수정');
  await assert.rejects(store.deleteSeries('test-series', [{ series: 'test-series' }]), /사용 중/);
  await store.deleteSeries('test-series', []);
  assert.equal((await store.listSeries()).length, 0);
});
