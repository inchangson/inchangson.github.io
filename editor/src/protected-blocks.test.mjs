import assert from 'node:assert/strict';
import test from 'node:test';
import { extractProtectedBlocks, restoreProtectedBlocks } from './protected-blocks.js';

test('details 블록을 WYSIWYG 안전 토큰으로 바꾼 뒤 원문 그대로 복원한다', () => {
  const source = [
    '# 본문',
    '',
    '<details>',
    '<summary>정답과 해설</summary>',
    '',
    '1. 첫 번째 답',
    '2. 두 번째 답',
    '',
    '</details>',
    '',
    '마지막 문단',
  ].join('\n');
  const extracted = extractProtectedBlocks(source);
  assert.equal(extracted.blocks.length, 1);
  assert.match(extracted.markdown, /```blog-details\nBLOG_DETAILS_BLOCK_1\n```/);
  assert.equal(restoreProtectedBlocks(extracted.markdown, extracted.blocks), source);
});

test('여러 details 블록을 각각 복원하고 편집된 HTML도 반영한다', () => {
  const source = '<details>\n<summary>A</summary>\n\na\n</details>\n\n<details>\n<summary>B</summary>\n\nb\n</details>';
  const extracted = extractProtectedBlocks(source);
  assert.equal(extracted.blocks.length, 2);
  extracted.blocks[1].raw = '<details>\n<summary>변경</summary>\n\nc\n</details>';
  const restored = restoreProtectedBlocks(extracted.markdown, extracted.blocks);
  assert.match(restored, /<summary>A<\/summary>/);
  assert.match(restored, /<summary>변경<\/summary>/);
});
