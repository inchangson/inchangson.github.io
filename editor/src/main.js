import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import '@toast-ui/editor/dist/i18n/ko-kr';
import { extractProtectedBlocks, restoreProtectedBlocks } from './protected-blocks.js';
import './style.css';

const elements = {
  postList: document.querySelector('#post-list'),
  search: document.querySelector('#post-search'),
  newPost: document.querySelector('#new-post'),
  emptyNewPost: document.querySelector('#empty-new-post'),
  emptyState: document.querySelector('#empty-state'),
  editorScreen: document.querySelector('#editor-screen'),
  save: document.querySelector('#save-post'),
  saveStatus: document.querySelector('#save-status'),
  documentKind: document.querySelector('#document-kind'),
  documentTitle: document.querySelector('#document-title'),
  previewLink: document.querySelector('#preview-link'),
  title: document.querySelector('#title'),
  slug: document.querySelector('#slug'),
  description: document.querySelector('#description'),
  pubDate: document.querySelector('#pub-date'),
  updatedDate: document.querySelector('#updated-date'),
  tags: document.querySelector('#tags'),
  draft: document.querySelector('#draft'),
  htmlButton: document.querySelector('#html-blocks-button'),
  htmlCount: document.querySelector('#html-block-count'),
  htmlDialog: document.querySelector('#html-blocks-dialog'),
  htmlList: document.querySelector('#html-blocks-list'),
  applyHtml: document.querySelector('#apply-html-blocks'),
  toast: document.querySelector('#toast'),
};

const state = {
  posts: [],
  currentSlug: null,
  revision: null,
  isNew: false,
  dirty: false,
  bodyDirty: false,
  loadingEditor: false,
  originalBody: '',
  protectedBlocks: [],
};

const editor = new Editor({
  el: document.querySelector('#toast-editor'),
  height: '640px',
  minHeight: '420px',
  initialEditType: 'wysiwyg',
  previewStyle: 'vertical',
  language: 'ko-KR',
  usageStatistics: false,
  placeholder: '내용을 입력하세요. / 대신 툴바와 Markdown 단축키를 사용할 수 있습니다.',
  toolbarItems: [
    ['heading', 'bold', 'italic', 'strike'],
    ['hr', 'quote'],
    ['ul', 'ol', 'task'],
    ['table', 'link', 'image'],
    ['code', 'codeblock'],
    ['scrollSync'],
  ],
  hooks: {
    addImageBlobHook: async (blob, callback) => {
      try {
        const slug = elements.slug.value.trim();
        if (!slug) throw new Error('이미지를 추가하기 전에 slug를 입력해 주세요.');
        if (state.isNew) throw new Error('새 글을 한 번 저장한 뒤 이미지를 추가해 주세요.');
        if (blob.size > 10 * 1024 * 1024) throw new Error('이미지는 10MB 이하여야 합니다.');
        const result = await uploadImage(slug, blob);
        callback(result.url, blob.name || 'image');
        markDirty(true);
        showToast('이미지를 저장했습니다.');
      } catch (error) {
        showToast(error.message, true);
      }
    },
  },
  events: {
    change: () => {
      if (state.loadingEditor) return;
      markDirty(true);
      scheduleMermaidPreview();
    },
  },
});

const fields = [
  elements.title,
  elements.slug,
  elements.description,
  elements.pubDate,
  elements.updatedDate,
  elements.tags,
  elements.draft,
];

fields.forEach((field) => {
  field.addEventListener('input', () => {
    markDirty(false);
    updateDocumentHeader();
  });
  field.addEventListener('change', () => markDirty(false));
});

elements.search.addEventListener('input', renderPostList);
elements.newPost.addEventListener('click', beginNewPost);
elements.emptyNewPost.addEventListener('click', beginNewPost);
elements.save.addEventListener('click', saveCurrentPost);
elements.htmlButton.addEventListener('click', openHtmlBlocksDialog);
elements.applyHtml.addEventListener('click', applyHtmlBlocks);

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (!elements.save.disabled) void saveCurrentPost();
  }
});

function markDirty(bodyChanged) {
  state.dirty = true;
  state.bodyDirty ||= bodyChanged;
  elements.save.disabled = false;
  elements.saveStatus.textContent = '저장하지 않음';
  elements.saveStatus.classList.add('is-dirty');
}

function markClean() {
  state.dirty = false;
  state.bodyDirty = false;
  elements.save.disabled = false;
  elements.saveStatus.textContent = '저장됨';
  elements.saveStatus.classList.remove('is-dirty');
}

function confirmDiscard() {
  return !state.dirty || window.confirm('저장하지 않은 변경 사항을 버릴까요?');
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `요청에 실패했습니다 (${response.status}).`);
  return result;
}

async function loadPostList() {
  try {
    const result = await api('/api/posts');
    state.posts = result.posts;
    renderPostList();
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderPostList() {
  const query = elements.search.value.trim().toLocaleLowerCase('ko');
  const filtered = state.posts.filter((post) =>
    [post.title, post.description, post.slug, ...(post.tags || [])].join(' ').toLocaleLowerCase('ko').includes(query),
  );
  elements.postList.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'post-list__empty';
    empty.textContent = query ? '검색 결과가 없습니다.' : '아직 작성한 글이 없습니다.';
    elements.postList.append(empty);
    return;
  }

  filtered.forEach((post) => {
    const button = document.createElement('button');
    button.className = 'post-item';
    if (post.slug === state.currentSlug) button.classList.add('is-active');
    button.type = 'button';
    button.innerHTML = `
      <span class="post-item__title"></span>
      <span class="post-item__meta"><span>${escapeHtml(post.pubDate)}</span><span>${post.draft ? '초안' : escapeHtml(post.tags?.[0] || '게시됨')}</span></span>
    `;
    button.querySelector('.post-item__title').textContent = post.title;
    button.addEventListener('click', () => void selectPost(post.slug));
    elements.postList.append(button);
  });
}

async function selectPost(slug) {
  if (slug === state.currentSlug && !state.isNew) return;
  if (!confirmDiscard()) return;
  setBusy(true, '불러오는 중');
  try {
    const post = await api(`/api/posts/${encodeURIComponent(slug)}`);
    state.currentSlug = post.slug;
    state.revision = post.revision;
    state.isNew = false;
    state.originalBody = post.body;
    setForm(post.slug, post.metadata, false);
    setEditorBody(post.body);
    showEditor();
    markClean();
    renderPostList();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setBusy(false);
  }
}

function beginNewPost() {
  if (!confirmDiscard()) return;
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  state.currentSlug = null;
  state.revision = null;
  state.isNew = true;
  state.originalBody = '';
  setForm('', { title: '', description: '', pubDate: localToday, updatedDate: '', tags: [], draft: true }, true);
  setEditorBody('');
  showEditor();
  markDirty(false);
  renderPostList();
  elements.title.focus();
}

function setForm(slug, metadata, isNew) {
  elements.slug.value = slug;
  elements.slug.readOnly = !isNew;
  elements.title.value = metadata.title || '';
  elements.description.value = metadata.description || '';
  elements.pubDate.value = metadata.pubDate || '';
  elements.updatedDate.value = metadata.updatedDate || '';
  elements.tags.value = (metadata.tags || []).join(', ');
  elements.draft.checked = metadata.draft === true;
  updateDocumentHeader();
}

function showEditor() {
  elements.emptyState.hidden = true;
  elements.editorScreen.hidden = false;
  elements.save.disabled = false;
  requestAnimationFrame(() => editor.setHeight(`${Math.max(520, window.innerHeight - 360)}px`));
}

function updateDocumentHeader() {
  const title = elements.title.value.trim();
  const slug = elements.slug.value.trim();
  elements.documentKind.textContent = state.isNew ? 'NEW DOCUMENT' : elements.draft.checked ? 'DRAFT' : 'PUBLISHED';
  elements.documentTitle.textContent = title || '제목 없는 글';
  if (slug && !state.isNew) {
    elements.previewLink.href = `http://localhost:4321/blog/${encodeURIComponent(slug)}`;
    elements.previewLink.classList.remove('is-disabled');
  } else {
    elements.previewLink.href = '#';
    elements.previewLink.classList.add('is-disabled');
  }
}

function setEditorBody(body) {
  const extracted = extractProtectedBlocks(body);
  state.protectedBlocks = extracted.blocks;
  state.loadingEditor = true;
  editor.setMarkdown(extracted.markdown, false);
  queueMicrotask(() => {
    state.loadingEditor = false;
    scheduleMermaidPreview();
  });
  updateHtmlButton();
}

function updateHtmlButton() {
  elements.htmlButton.hidden = state.protectedBlocks.length === 0;
  elements.htmlCount.textContent = state.protectedBlocks.length ? `(${state.protectedBlocks.length})` : '';
}

function openHtmlBlocksDialog() {
  elements.htmlList.replaceChildren();
  state.protectedBlocks.forEach((block, index) => {
    const label = document.createElement('label');
    label.className = 'html-source-field';
    const title = document.createElement('span');
    title.textContent = `HTML 블록 ${index + 1}`;
    const textarea = document.createElement('textarea');
    textarea.rows = 12;
    textarea.spellcheck = false;
    textarea.value = block.raw;
    textarea.dataset.index = String(index);
    label.append(title, textarea);
    elements.htmlList.append(label);
  });
  elements.htmlDialog.showModal();
}

function applyHtmlBlocks(event) {
  event.preventDefault();
  elements.htmlList.querySelectorAll('textarea').forEach((textarea) => {
    state.protectedBlocks[Number(textarea.dataset.index)].raw = textarea.value.trim();
  });
  elements.htmlDialog.close();
  markDirty(true);
}

function formPayload() {
  return {
    title: elements.title.value.trim(),
    description: elements.description.value.trim(),
    pubDate: elements.pubDate.value,
    updatedDate: elements.updatedDate.value,
    tags: [...new Set(elements.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean))],
    draft: elements.draft.checked,
  };
}

function validateForm() {
  const slug = elements.slug.value.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    elements.slug.focus();
    throw new Error('slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
  }
  if (!elements.title.value.trim() || !elements.description.value.trim() || !elements.pubDate.value) {
    throw new Error('제목, 설명, 발행일은 필수입니다.');
  }
  return slug;
}

async function saveCurrentPost() {
  if (elements.editorScreen.hidden) return;
  let slug;
  try {
    slug = validateForm();
  } catch (error) {
    showToast(error.message, true);
    return;
  }

  setBusy(true, '저장 중');
  try {
    const body = state.bodyDirty ? restoreProtectedBlocks(editor.getMarkdown(), state.protectedBlocks) : state.originalBody;
    const payload = { slug, metadata: formPayload(), body, revision: state.revision };
    const saved = state.isNew
      ? await api('/api/posts', { method: 'POST', body: JSON.stringify(payload) })
      : await api(`/api/posts/${encodeURIComponent(slug)}`, { method: 'PUT', body: JSON.stringify(payload) });

    state.currentSlug = saved.slug;
    state.revision = saved.revision;
    state.isNew = false;
    state.originalBody = saved.body;
    elements.slug.readOnly = true;
    setEditorBody(saved.body);
    markClean();
    await loadPostList();
    updateDocumentHeader();
    showToast('저장했습니다.');
  } catch (error) {
    showToast(error.message, true);
    elements.saveStatus.textContent = '저장 실패';
  } finally {
    setBusy(false);
  }
}

async function uploadImage(slug, blob) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
  const base64 = String(dataUrl).split(',')[1];
  return api(`/api/posts/${encodeURIComponent(slug)}/assets`, {
    method: 'POST',
    body: JSON.stringify({ name: blob.name || 'image', type: blob.type, data: base64 }),
  });
}

let mermaidTimer;
let mermaidApi;
function scheduleMermaidPreview() {
  window.clearTimeout(mermaidTimer);
  mermaidTimer = window.setTimeout(renderMermaidPreview, 350);
}

async function renderMermaidPreview() {
  const blocks = document.querySelectorAll('.toastui-editor-md-preview pre code.language-mermaid');
  if (!blocks.length) return;
  blocks.forEach((block) => {
    if (block.parentElement?.dataset.mermaidPending) return;
    const container = document.createElement('div');
    container.className = 'mermaid';
    container.textContent = block.textContent || '';
    block.parentElement?.replaceWith(container);
  });
  try {
    if (!mermaidApi) {
      const { default: mermaid } = await import('mermaid');
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
      mermaidApi = mermaid;
    }
    await mermaidApi.run({ querySelector: '.toastui-editor-md-preview .mermaid' });
  } catch (error) {
    console.warn('Mermaid preview failed', error);
  }
}

function setBusy(busy, label = '') {
  elements.save.disabled = busy;
  if (busy) elements.saveStatus.textContent = label;
}

let toastTimer;
function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.className = isError ? 'is-visible is-error' : 'is-visible';
  toastTimer = window.setTimeout(() => {
    elements.toast.className = '';
  }, 3200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

void loadPostList();
