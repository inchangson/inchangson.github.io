import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { createDocumentStore } from './documents.mjs';

const currentResume = JSON.parse(await readFile(new URL('../../src/data/resume.json', import.meta.url), 'utf8'));

test('현재 Resume의 프로젝트와 대표 경험을 읽고 수정해도 다른 내용은 보존한다', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'resume-compat-'));
  try {
    await mkdir(path.join(root, 'src/data'), { recursive: true });
    await writeFile(path.join(root, 'src/data/resume.json'), JSON.stringify(currentResume));
    const store = createDocumentStore(root);
    const original = await store.readResume();
    const updated = structuredClone(original.data);
    updated.sections.find(s => s.type === 'timeline').groups[0].projects[0].items[0].title = '수정한 경력';
    updated.sections.find(s => s.type === 'caseStudies').cases[0].sections[0].paragraphs[0] = '수정한 상세 내용';
    const saved = await store.updateResume({ data: updated, revision: original.revision });
    assert.deepEqual(saved.data, updated);
    assert.deepEqual((await store.readResume()).data, updated);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Resume 폼은 프로젝트, 대표 경험, 기존 타임라인의 중첩 편집 경로를 렌더링한다', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const context = vm.createContext({
    state: { resume: currentResume },
    elements: { resumeProfile: {}, resumeSections: {} },
    escapeHtml: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
  });
  vm.runInContext(source.slice(source.indexOf('const input = '), source.indexOf('\nfunction getAt(')), context);
  vm.runInContext('renderResume()', context);
  const html = context.elements.resumeSections.innerHTML;
  const timelineIndex = currentResume.sections.findIndex(s => s.type === 'timeline');
  const casesIndex = currentResume.sections.findIndex(s => s.type === 'caseStudies');
  assert.ok(html.includes(`data-path="sections.${timelineIndex}.company.name"`));
  assert.ok(html.includes(`data-path="sections.${timelineIndex}.groups.0.projects.0.items.0.title"`));
  assert.ok(html.includes(`data-path="sections.${casesIndex}.cases.0.sections.0.paragraphs.0"`));
  const legacy = vm.runInContext(`renderTimelineGroup({ title: '기존', items: [{ title: '<script>', highlights: [] }] }, 'sections.0', 0)`, context);
  assert.ok(legacy.includes('data-path="sections.0.groups.0.items.0.title"'));
  assert.ok(legacy.includes('&lt;script>'));
  vm.runInContext(source.slice(source.indexOf('function getAt('), source.indexOf('\nfunction resumeChanged(')), context);
  context.state.resume = { sections: [{ groups: [{}] }] };
  vm.runInContext(`setAt('sections.0.company.name', '회사'); setAt('sections.0.groups.0.projects', []); getAt('sections.0.groups.0.projects').push({title: '새 프로젝트'});`, context);
  assert.equal(context.state.resume.sections[0].company.name, '회사');
  assert.equal(context.state.resume.sections[0].groups[0].projects[0].title, '새 프로젝트');
});
