import assert from 'node:assert/strict';
import test from 'node:test';
import { createSequentialRenderQueue } from '../../src/lib/mermaid-client.js';

test('Mermaid 렌더링을 순차 실행하고 고유 ID를 부여한다', async () => {
  let active = 0;
  let maxActive = 0;
  const ids = [];
  const render = createSequentialRenderQueue(async (id) => {
    ids.push(id);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active -= 1;
    return id;
  });

  await Promise.all([render('a', 'post'), render('b', 'post'), render('c', 'post')]);
  assert.equal(maxActive, 1);
  assert.equal(new Set(ids).size, 3);
});

test('한 렌더링 실패 뒤에도 다음 작업을 계속한다', async () => {
  const completed = [];
  const render = createSequentialRenderQueue(async (id, source) => {
    if (source === 'bad') throw new Error('parse error');
    completed.push(id);
    return id;
  });

  await assert.rejects(render('bad', 'editor'));
  await render('good', 'editor');
  assert.equal(completed.length, 1);
  assert.match(completed[0], /^mermaid-editor-/);
});
