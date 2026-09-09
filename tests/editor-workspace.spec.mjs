import { test, expect } from '@playwright/test';

test('persistent controls preserve drafts and editing position across saves and tabs', async ({ page }) => {
  const body = Array.from({ length: 100 }, (_, i) => `Paragraph ${i} with enough text to scroll.`).join('\n\n');
  const metadata = { title: 'Position test', description: 'Test', pubDate: '2026-09-10', category: 'Test', tags: [] };
  let saves = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let result;
    if (path === '/api/posts') result = { posts: [{ slug: 'position-test', ...metadata }] };
    else if (path === '/api/posts/position-test') {
      if (route.request().method() === 'PUT') {
        saves++;
        await new Promise(resolve => setTimeout(resolve, 150));
        result = { ...route.request().postDataJSON(), revision: `r${saves}` };
      } else result = { slug: 'position-test', metadata, body, revision: 'r0' };
    } else if (path === '/api/series') result = { series: [] };
    else if (path === '/api/categories') result = { categories: [{ name: 'Test', subcategories: [] }], revision: 'c0' };
    else if (path === '/api/resume') result = { data: { profile: { name: 'Tester', contacts: [] }, sections: Array.from({ length: 20 }, () => ({ type: 'prose', title: 'Section', paragraphs: ['Paragraph'] })) }, revision: 'resume0' };
    else throw new Error(path);
    await route.fulfill({ json: result });
  });
  await page.goto('/');
  await expect(page.locator('#title')).toHaveValue('Position test');
  await page.locator('#title').fill('Unsaved post');
  await page.evaluate(() => {
    const container = document.querySelector('.toastui-editor-ww-container');
    container.scrollTop = 900;
    window.scrollTo(0, 550);
    window.originalEditor = container.querySelector('[contenteditable]');
  });
  const position = await page.evaluate(() => ({ y: window.scrollY, inner: document.querySelector('.toastui-editor-ww-container').scrollTop }));
  await page.locator('#nav-resume').click();
  await expect(page.locator('[data-path="profile.name"]')).toHaveValue('Tester');
  await page.locator('[data-path="profile.name"]').fill('Draft resume');
  await page.evaluate(() => window.scrollTo(0, 1400));
  const resumeY = await page.evaluate(() => window.scrollY);
  await page.locator('#nav-posts').click();
  await expect(page.locator('#title')).toHaveValue('Unsaved post');
  await expect(page.locator('#save-status')).toHaveText('저장하지 않음');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(position.y);
  await expect.poll(() => page.locator('.toastui-editor-ww-container').evaluate(el => el.scrollTop)).toBe(position.inner);
  await page.locator('#toggle-sidebar').click();
  await expect(page.locator('#sidebar')).toBeHidden();
  await expect(page.locator('#toggle-sidebar')).toHaveAttribute('aria-expanded', 'false');
  await page.evaluate(() => {
    const node = document.querySelector('.toastui-editor-ww-container [contenteditable] p').firstChild;
    const range = document.createRange();
    range.setStart(node, 4);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    window.savedCaret = node;
  });
  await page.locator('#save-current').click();
  await expect(page.locator('#bottom-save-status')).toHaveText('저장됨');
  expect(await page.evaluate(() => window.getSelection().anchorNode === window.savedCaret && window.getSelection().anchorOffset === 4)).toBe(true);
  expect(saves).toBe(1);
  expect(await page.evaluate(() => window.originalEditor === document.querySelector('.toastui-editor-ww-container [contenteditable]'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(position.y);
  await page.locator('#toggle-sidebar').click();
  await page.locator('#nav-resume').click();
  await expect(page.locator('[data-path="profile.name"]')).toHaveValue('Draft resume');
  await expect(page.locator('#save-status')).toHaveText('저장하지 않음');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(resumeY);
  await page.locator('#save-current').click();
  await expect(page.locator('#bottom-save-status')).toHaveText('저장됨');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(resumeY);
});
