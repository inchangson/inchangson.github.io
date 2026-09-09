import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePostFile } from '../editor/lib/posts.mjs';

const clientUrl = `/@fs${resolve('src/lib/mermaid-client.js')}`;
const posts = readdirSync('src/content/posts').map(file => {
  const source = readFileSync(`src/content/posts/${file}`, 'utf8');
  return { file, slug: file.replace(/\.md$/, ''), ...parsePostFile(source), count: [...source.matchAll(/^```mermaid/gm)].length };
}).filter(post => post.count);

async function blankPage(page) {
  await page.route('**/mermaid-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto('/mermaid-test');
}

test('repository Mermaid sources all render, including standalone documents', async ({ page }) => {
  const diagrams = [];
  for (const root of ['src/content', 'docs', 'lab']) {
    for (const file of readdirSync(root, { recursive: true }).filter(file => /\.(md|html)$/.test(file))) {
      const path = `${root}/${file}`;
      const source = readFileSync(path, 'utf8');
      const pattern = file.endsWith('.md') ? /^```mermaid[^\n]*\n([\s\S]*?)^```/gm : /<div class="mermaid">([\s\S]*?)<\/div>/g;
      for (const match of source.matchAll(pattern)) diagrams.push({ path, line: source.slice(0, match.index).split('\n').length, source: match[1] });
    }
  }
  await blankPage(page);
  const failures = await page.evaluate(async ({ diagrams, clientUrl }) => {
    const { renderMermaidSource } = await import(clientUrl);
    const failures = [];
    for (const diagram of diagrams) {
      const container = document.createElement('div');
      document.body.append(container);
      const result = await renderMermaidSource(container, diagram.source, 'audit');
      if (!result.ok || !container.querySelector('svg')) failures.push({ ...diagram, error: result.error?.message });
      container.remove();
    }
    return failures;
  }, { diagrams, clientUrl });
  expect(failures, `${diagrams.length} diagrams audited`).toEqual([]);
  console.log(`Audited ${diagrams.length} Mermaid sources`);
});

test('all blog diagrams render on their actual pages', async ({ page }) => {
  for (const post of posts) {
    await page.goto(`http://127.0.0.1:4331/blog/${post.slug}`);
    await expect(page.locator('.post__content .mermaid svg'), post.file).toHaveCount(post.count);
    await expect(page.locator('.mermaid-render-error, .mermaid-source-error')).toHaveCount(0);
  }
});

test('all editor diagrams render in WYSIWYG and Markdown, including mode switches', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  for (const post of posts) {
    await page.locator('#post-list button').filter({ has: page.getByText(post.metadata.title, { exact: true }) }).click();
    await expect(page.locator('#slug')).toHaveValue(post.slug);
    await expect(page.locator('.toastui-editor-ww-container .mermaid-preview svg'), post.file).toHaveCount(post.count);
    await expect(page.locator('#mermaid-refresh-button')).toBeEnabled();
    await page.getByText('마크다운', { exact: true }).click();
    await expect(page.locator('.toastui-editor-md-preview .mermaid-preview svg'), post.file).toHaveCount(post.count);
    await expect(page.locator('.toastui-editor-md-preview .mermaid-preview[data-nodeid]')).toHaveCount(post.count);
    await page.getByText('위지윅', { exact: true }).click();
    await expect(page.locator('.toastui-editor-ww-container .mermaid-preview svg')).toHaveCount(post.count);
    await expect(page.locator('#mermaid-preview-status')).toBeHidden();
  }
});

test('invalid diagrams preserve source, clean up temporary SVGs and recover on retry', async ({ page }) => {
  await blankPage(page);
  const result = await page.evaluate(async clientUrl => {
    const { renderMermaidCodeBlocks, renderMermaidSource } = await import(clientUrl);
    document.body.innerHTML = '<main><pre data-nodeid="42"><code class="language-mermaid">flowchart TD\n A[broken</code></pre></main>';
    const root = document.querySelector('main');
    const failed = await renderMermaidCodeBlocks(root);
    const errorCount = root.querySelectorAll('.mermaid-render-error').length;
    root.querySelector('code').textContent = 'flowchart TD\n A[Recovered] --> B[OK]';
    await renderMermaidCodeBlocks(root);
    const target = document.createElement('div');
    root.append(target);
    const pending = renderMermaidSource(target, 'flowchart TD\n A[Old]');
    const current = renderMermaidSource(target, 'flowchart TD\n A[Latest]');
    await Promise.all([pending, current]);
    return {
      failed: failed[0].ok, errorCount,
      recovered: !!root.querySelector('[data-nodeid="42"] svg'),
      errors: root.querySelectorAll('.mermaid-render-error').length,
      temporary: document.querySelectorAll('body > div[id^="dmermaid-"]').length,
      latest: target.textContent.includes('Latest') && !target.textContent.includes('Old'),
    };
  }, clientUrl);
  expect(result).toEqual({ failed: false, errorCount: 1, recovered: true, errors: 0, temporary: 0, latest: true });
});

test('WYSIWYG failures are reported only after rendering finishes', async ({ page }) => {
  await page.route('**/api/posts/*', async route => {
    const response = await route.fetch();
    const post = await response.json();
    post.body = '```mermaid\nflowchart TD\n A[broken\n```\n';
    await route.fulfill({ response, json: post });
  });
  await page.goto('/');
  await expect(page.locator('#mermaid-preview-status')).toHaveText('1개 렌더링 실패');
  await expect(page.locator('#mermaid-refresh-button')).toBeEnabled();
  await expect(page.locator('.toastui-editor-ww-container .mermaid-preview.is-error')).toContainText('Parse error');
});

test('Markdown preview updates an already rendered block after editing its source', async ({ page }) => {
  await page.route('**/api/posts/*', async route => {
    const response = await route.fetch();
    const post = await response.json();
    post.body = '```mermaid\nflowchart TD\n A[BeforeEdit]\n```\n';
    await route.fulfill({ response, json: post });
  });
  await page.goto('/');
  await expect(page.locator('.toastui-editor-ww-container .mermaid-preview svg')).toHaveCount(1);
  await page.getByText('마크다운', { exact: true }).click();
  const preview = page.locator('.toastui-editor-md-preview');
  await expect(preview.locator('svg')).toContainText('BeforeEdit');
  await page.locator('.toastui-editor-md-container .ProseMirror').fill('```mermaid\nflowchart TD\n A[AfterEdit]\n```');
  await page.locator('#mermaid-refresh-button').click();
  await expect(preview.locator('svg')).toHaveCount(1);
  await expect(preview.locator('svg')).toContainText('AfterEdit');
  await expect(preview).not.toContainText('BeforeEdit');
});

test('module fetch failure explains recovery and a page reload restores rendering', async ({ page }) => {
  await blankPage(page);
  let blocked = false;
  await page.route('**/mermaid.js*', async route => {
    if (!blocked) { blocked = true; await route.abort(); }
    else await route.continue();
  });
  const render = () => page.evaluate(async clientUrl => {
    const { renderMermaidSource } = await import(clientUrl);
    const container = document.createElement('div');
    document.body.append(container);
    const result = await renderMermaidSource(container, 'flowchart TD\n A[Recovered]');
    return { ok: result.ok, svg: !!container.querySelector('svg') };
  }, clientUrl);
  expect(await render()).toEqual({ ok: false, svg: false });
  expect(blocked).toBe(true);
  await expect(page.locator('body')).toContainText('Mermaid 파일을 불러오지 못했습니다.');
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: '페이지 새로고침' }).click()]);
  expect(await render()).toEqual({ ok: true, svg: true });
});
