import Editor from '@toast-ui/editor';
import codeSyntaxHighlight from '@toast-ui/editor-plugin-code-syntax-highlight';
import Prism from 'prismjs';
import '@toast-ui/editor/dist/toastui-editor.css';
import '@toast-ui/editor/dist/i18n/ko-kr';
import '@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight.css';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-graphql.js';
import 'prismjs/components/prism-protobuf.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-ini.js';
import 'prismjs/components/prism-groovy.js';
import { extractProtectedBlocks, restoreProtectedBlocks } from './protected-blocks.js';
import { POST_VIEWS, filterPosts, groupPosts, resolveInitialPostSlug } from './post-navigation.js';
import { renderMermaidCodeBlocks, renderMermaidSource } from '../../src/lib/mermaid-client.js';
import { confluencePastePlugin } from './paste-normalizer.js';
import './style.css';

Prism.languages.proto = Prism.languages.protobuf;
Prism.languages.sh = Prism.languages.bash;
Prism.languages.shell = Prism.languages.bash;

const LAST_POST_STORAGE_KEY = 'blog-editor:last-post-slug';
const MERMAID_REFRESH_EVENT = 'refreshMermaidPreviews';
let requestWysiwygMermaidRefresh = async () => [];

function mermaidPreviewPlugin(context) {
  const pluginKey = new context.pmState.PluginKey('mermaidPreview');
  let renderVersion = 0;
  let renderTasks = [];

  function decorationsFor(doc) {
    renderVersion += 1;
    const decorations = [];
    let index = 0;
    doc.descendants((node, pos) => {
      if (node.type.name !== 'codeBlock' || String(node.attrs.language).toLowerCase() !== 'mermaid') return;
      index += 1;
      const source = node.textContent;
      const key = `mermaid-${renderVersion}-${index}`;
      decorations.push(context.pmView.Decoration.widget(pos + node.nodeSize, () => {
        const container = document.createElement('div');
        container.className = 'mermaid-preview';
        renderTasks.push(renderMermaidSource(container, source, key));
        return container;
      }, { key, side: -1 }));
    });
    return context.pmView.DecorationSet.create(doc, decorations);
  }

  return {
    wysiwygPlugins: [() => new context.pmState.Plugin({
      key: pluginKey,
      state: {
        init: (_, state) => decorationsFor(state.doc),
        apply: (transaction, decorations) => transaction.getMeta(pluginKey) === MERMAID_REFRESH_EVENT
          ? decorationsFor(transaction.doc)
          : decorations.map(transaction.mapping, transaction.doc),
      },
      props: {
        decorations: (editorState) => pluginKey.getState(editorState),
      },
      view: (view) => {
        requestWysiwygMermaidRefresh = () => {
          renderTasks = [];
          view.dispatch(view.state.tr.setMeta(pluginKey, MERMAID_REFRESH_EVENT));
          return Promise.all(renderTasks);
        };
        return { destroy: () => { requestWysiwygMermaidRefresh = async () => []; } };
      },
    })],
  };
}

const elements = {
  postList: document.querySelector('#post-list'),
  postSidebar: document.querySelector('#post-sidebar'),
  navPosts: document.querySelector('#nav-posts'),
  navResume: document.querySelector('#nav-resume'),
  navSeries: document.querySelector('#nav-series'),
  navCategories: document.querySelector('#nav-categories'),
  search: document.querySelector('#post-search'),
  postViewTabs: document.querySelector('#post-view-tabs'),
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
  category: document.querySelector('#category'),
  subcategory: document.querySelector('#subcategory'),
  tags: document.querySelector('#tags'),
  tagChips: document.querySelector('#tag-chips'),
  tagOptions: document.querySelector('#tag-options'),
  series: document.querySelector('#series'),
  seriesOrder: document.querySelector('#series-order'),
  seriesLabel: document.querySelector('#series-label'),
  draft: document.querySelector('#draft'),
  htmlButton: document.querySelector('#html-blocks-button'),
  htmlCount: document.querySelector('#html-block-count'),
  htmlDialog: document.querySelector('#html-blocks-dialog'),
  htmlList: document.querySelector('#html-blocks-list'),
  applyHtml: document.querySelector('#apply-html-blocks'),
  mermaidRefresh: document.querySelector('#mermaid-refresh-button'),
  mermaidStatus: document.querySelector('#mermaid-preview-status'),
  toast: document.querySelector('#toast'),
  resumeScreen: document.querySelector('#resume-screen'),
  resumeProfile: document.querySelector('#resume-profile'),
  resumeSections: document.querySelector('#resume-sections'),
  saveResume: document.querySelector('#save-resume'),
  newSectionType: document.querySelector('#new-section-type'),
  addSection: document.querySelector('#add-section'),
  seriesScreen: document.querySelector('#series-screen'),
  seriesList: document.querySelector('#series-list'),
  seriesForm: document.querySelector('#series-form'),
  newSeries: document.querySelector('#new-series'),
  seriesId: document.querySelector('#series-id'),
  seriesTitle: document.querySelector('#series-title'),
  seriesDescription: document.querySelector('#series-description'),
  seriesFormTitle: document.querySelector('#series-form-title'),
  deleteSeries: document.querySelector('#delete-series'),
  categoriesScreen: document.querySelector('#categories-screen'),
  categoryList: document.querySelector('#category-list'),
  newCategory: document.querySelector('#new-category'),
  saveCategories: document.querySelector('#save-categories'),
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
  tags: [],
  series: [],
  categories: [],
  categoryRevision: null,
  categoryMigrations: [],
  resume: null,
  resumeRevision: null,
  currentSeries: null,
  mode: 'posts',
  postView: POST_VIEWS.all,
  collapsedPostGroups: new Set(),
  mermaidStale: false,
};

const editor = new Editor({
  el: document.querySelector('#toast-editor'),
  height: `${editorHeight()}px`,
  minHeight: '760px',
  initialEditType: 'wysiwyg',
  previewStyle: 'vertical',
  language: 'ko-KR',
  usageStatistics: false,
  plugins: [
    [codeSyntaxHighlight, { highlighter: Prism }],
    confluencePastePlugin,
    mermaidPreviewPlugin,
  ],
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
      updateMermaidControls(true);
    },
    changeMode: () => queueMicrotask(() => void refreshMermaidPreviews()),
  },
});

const fields = [
  elements.title,
  elements.slug,
  elements.description,
  elements.pubDate,
  elements.updatedDate,
  elements.category,
  elements.subcategory,
  elements.series,
  elements.seriesOrder,
  elements.seriesLabel,
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
elements.postViewTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-post-view]');
  if (!button) return;
  state.postView = button.dataset.postView;
  elements.postViewTabs.querySelectorAll('button').forEach((item) => item.classList.toggle('is-active', item === button));
  renderPostList();
});
elements.newPost.addEventListener('click', beginNewPost);
elements.emptyNewPost.addEventListener('click', beginNewPost);
elements.save.addEventListener('click', saveCurrentPost);
elements.mermaidRefresh.addEventListener('click', () => void refreshMermaidPreviews());
elements.htmlButton.addEventListener('click', openHtmlBlocksDialog);
elements.applyHtml.addEventListener('click', applyHtmlBlocks);
elements.navPosts.addEventListener('click', () => void switchMode('posts'));
elements.navResume.addEventListener('click', () => void switchMode('resume'));
elements.navSeries.addEventListener('click', () => void switchMode('series'));
elements.navCategories.addEventListener('click', () => void switchMode('categories'));
elements.tags.addEventListener('keydown', handleTagInput);
elements.tags.addEventListener('blur', commitTagInput);
elements.series.addEventListener('change', updateSeriesFields);
elements.category.addEventListener('change', () => renderSubcategoryOptions());
elements.saveResume.addEventListener('click', () => void saveResume());
elements.addSection.addEventListener('click', addResumeSection);
elements.newSeries.addEventListener('click', beginNewSeries);
elements.seriesForm.addEventListener('submit', (event) => { event.preventDefault(); void saveSeries(); });
elements.deleteSeries.addEventListener('click', () => void deleteSeries());
elements.newCategory.addEventListener('click', addCategory);
elements.saveCategories.addEventListener('click', () => void saveCategories());

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
});

let resizeTimer;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!elements.editorScreen.hidden) editor.setHeight(`${editorHeight()}px`);
  }, 120);
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (state.mode === 'resume') void saveResume();
    else if (state.mode === 'series') void saveSeries();
    else if (!elements.save.disabled) void saveCurrentPost();
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
    renderTaxonomyOptions();
    renderPostList();
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderPostList() {
  const query = elements.search.value.trim();
  const filtered = filterPosts(state.posts, query);
  elements.postList.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'post-list__empty';
    empty.textContent = query ? '검색 결과가 없습니다.' : '아직 작성한 글이 없습니다.';
    elements.postList.append(empty);
    return;
  }

  const groups = groupPosts(filtered, state.postView, state.series);
  if (state.postView === POST_VIEWS.all) {
    elements.postList.append(...groups[0].posts.map(createPostButton));
    return;
  }

  groups.forEach((group) => {
    const details = document.createElement('details');
    details.className = 'post-group';
    const groupStateKey = `${state.postView}\u0000${group.id}`;
    details.open = !state.collapsedPostGroups.has(groupStateKey);
    details.addEventListener('toggle', () => {
      if (details.open) state.collapsedPostGroups.delete(groupStateKey);
      else state.collapsedPostGroups.add(groupStateKey);
    });
    const summary = document.createElement('summary');
    const label = document.createElement('strong');
    const count = document.createElement('span');
    label.textContent = group.label;
    count.textContent = `${group.posts.length}`;
    summary.append(label, count);
    const items = document.createElement('div');
    items.className = 'post-group__items';
    items.append(...group.posts.map(createPostButton));
    details.append(summary, items);
    elements.postList.append(details);
  });
}

function createPostButton(post) {
  const button = document.createElement('button');
  button.className = 'post-item';
  if (post.slug === state.currentSlug) button.classList.add('is-active');
  button.type = 'button';
  button.innerHTML = `
    <span class="post-item__title"></span>
    <span class="post-item__meta"><span>${escapeHtml(post.pubDate)}</span><span>${post.draft ? '초안' : escapeHtml(post.category || '게시됨')}</span></span>
  `;
  button.querySelector('.post-item__title').textContent = post.title;
  button.addEventListener('click', () => void selectPost(post.slug));
  return button;
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
    localStorage.setItem(LAST_POST_STORAGE_KEY, post.slug);
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
  setForm('', { title: '', description: '', pubDate: localToday, updatedDate: '', category: '', subcategory: '', tags: [], series: '', draft: true }, true);
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
  elements.category.value = metadata.category || '';
  renderSubcategoryOptions(metadata.subcategory || '');
  state.tags = [...(metadata.tags || [])];
  elements.tags.value = '';
  renderTagChips();
  elements.series.value = metadata.series || '';
  elements.seriesOrder.value = metadata.seriesOrder ?? '';
  elements.seriesLabel.value = metadata.seriesLabel || '';
  updateSeriesFields();
  elements.draft.checked = metadata.draft === true;
  updateDocumentHeader();
}

function showEditor() {
  elements.emptyState.hidden = true;
  elements.editorScreen.hidden = false;
  elements.resumeScreen.hidden = true;
  elements.seriesScreen.hidden = true;
  elements.save.disabled = false;
  requestAnimationFrame(() => editor.setHeight(`${editorHeight()}px`));
}

function editorHeight() {
  return Math.max(760, Math.round(window.innerHeight * 0.8));
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
    updateMermaidControls(false);
    void refreshMermaidPreviews();
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
    category: elements.category.value.trim(),
    subcategory: elements.subcategory.value.trim(),
    tags: state.tags,
    series: elements.series.value,
    seriesOrder: elements.series.value ? Number(elements.seriesOrder.value) : undefined,
    seriesLabel: elements.series.value ? elements.seriesLabel.value.trim() : '',
    draft: elements.draft.checked,
  };
}

function validateForm() {
  const slug = elements.slug.value.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    elements.slug.focus();
    throw new Error('slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
  }
  if (!elements.title.value.trim() || !elements.description.value.trim() || !elements.pubDate.value || !elements.category.value.trim()) {
    throw new Error('제목, 설명, 발행일, 카테고리는 필수입니다.');
  }
  if (elements.series.value && !/^\d+$/.test(elements.seriesOrder.value)) throw new Error('시리즈 순서는 0 이상의 정수여야 합니다.');
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
    localStorage.setItem(LAST_POST_STORAGE_KEY, saved.slug);
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

function hasMermaidBlocks() {
  return /(?:^|\n)\s{0,3}(?:`{3,}|~{3,})mermaid(?:\s|$)/i.test(editor.getMarkdown());
}

function updateMermaidControls(stale) {
  const hasMermaid = hasMermaidBlocks();
  state.mermaidStale = hasMermaid && stale;
  elements.mermaidRefresh.hidden = !hasMermaid;
  elements.mermaidStatus.hidden = !state.mermaidStale;
  elements.mermaidStatus.textContent = state.mermaidStale ? '미리보기 갱신 필요' : '';
}

let mermaidRefreshVersion = 0;
async function refreshMermaidPreviews() {
  const version = ++mermaidRefreshVersion;
  const markdown = editor.getMarkdown();
  elements.mermaidRefresh.disabled = false;
  elements.mermaidRefresh.textContent = 'Mermaid 새로고침';
  if (!hasMermaidBlocks()) {
    updateMermaidControls(false);
    return;
  }
  elements.mermaidRefresh.disabled = true;
  elements.mermaidRefresh.textContent = 'Mermaid 렌더링 중';
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (version !== mermaidRefreshVersion) return;
    const results = editor.isWysiwygMode()
      ? await requestWysiwygMermaidRefresh()
      : await renderMermaidCodeBlocks(document, {
        selector: '.toastui-editor-md-preview pre.lang-mermaid > code, .toastui-editor-md-preview pre > code[data-language="mermaid"], .toastui-editor-md-preview pre > code.language-mermaid',
        scope: 'editor-markdown',
      });
    if (version !== mermaidRefreshVersion) return;
    if (markdown !== editor.getMarkdown()) {
      updateMermaidControls(true);
      return;
    }
    const failed = results.filter((result) => !result.ok).length;
    state.mermaidStale = failed > 0;
    elements.mermaidStatus.hidden = failed === 0;
    elements.mermaidStatus.textContent = failed ? `${failed}개 렌더링 실패` : '';
  } catch (error) {
    if (version !== mermaidRefreshVersion) return;
    state.mermaidStale = true;
    elements.mermaidStatus.hidden = false;
    elements.mermaidStatus.textContent = `미리보기 갱신 실패: ${error.message}`;
  } finally {
    if (version === mermaidRefreshVersion) {
      elements.mermaidRefresh.disabled = false;
      elements.mermaidRefresh.textContent = 'Mermaid 새로고침';
    }
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

function renderTaxonomyOptions() {
  const tags = [...new Set(state.posts.flatMap((post) => post.tags || []))].sort();
  const current = elements.category.value;
  elements.category.innerHTML = '<option value="">선택</option>' + state.categories.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('');
  elements.category.value = current;
  renderSubcategoryOptions();
  elements.tagOptions.innerHTML = tags.map((value) => `<option value="${escapeHtml(value)}"></option>`).join('');
}

function renderSubcategoryOptions(selected = elements.subcategory.value) {
  const category = state.categories.find((item) => item.name === elements.category.value);
  elements.subcategory.innerHTML = '<option value="">없음</option>' + (category?.subcategories || []).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  elements.subcategory.value = selected;
}

function handleTagInput(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    commitTagInput();
  }
  if (event.key === 'Backspace' && !elements.tags.value && state.tags.length) {
    state.tags.pop(); renderTagChips(); markDirty(false);
  }
}
function commitTagInput() {
  const values = elements.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean);
  if (!values.length) return;
  state.tags = [...new Set([...state.tags, ...values])];
  elements.tags.value = '';
  renderTagChips(); markDirty(false);
}
function renderTagChips() {
  elements.tagChips.replaceChildren(...state.tags.map((tag) => {
    const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'tag-chip'; chip.textContent = `${tag} ×`;
    chip.addEventListener('click', () => { state.tags = state.tags.filter((value) => value !== tag); renderTagChips(); markDirty(false); });
    return chip;
  }));
}
function updateSeriesFields() {
  document.querySelectorAll('.series-field').forEach((field) => { field.hidden = !elements.series.value; });
}

async function loadSeries() {
  const result = await api('/api/series');
  state.series = result.series.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  const current = elements.series.value;
  elements.series.innerHTML = '<option value="">없음</option>' + state.series.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join('');
  elements.series.value = current;
  renderSeriesList();
  renderPostList();
}

async function switchMode(mode) {
  if (!confirmDiscard()) return;
  markClean();
  state.mode = mode;
  [elements.navPosts, elements.navResume, elements.navSeries, elements.navCategories].forEach((button) => button.classList.remove('is-active'));
  elements[`nav${mode[0].toUpperCase()}${mode.slice(1)}`]?.classList.add('is-active');
  elements.postSidebar.hidden = mode !== 'posts';
  const hasPost = Boolean(state.currentSlug || state.isNew);
  elements.editorScreen.hidden = mode !== 'posts' || !hasPost;
  elements.resumeScreen.hidden = mode !== 'resume';
  elements.seriesScreen.hidden = mode !== 'series';
  elements.categoriesScreen.hidden = mode !== 'categories';
  elements.save.hidden = mode !== 'posts';
  elements.previewLink.hidden = mode === 'series' || mode === 'categories';
  elements.previewLink.href = mode === 'resume' ? 'http://localhost:4321/resume' : elements.previewLink.href;
  elements.previewLink.classList.toggle('is-disabled', mode === 'series' || mode === 'categories');
  elements.emptyState.hidden = mode !== 'posts' || hasPost;
  elements.documentKind.textContent = mode === 'posts' ? 'DOCUMENTS' : mode.toUpperCase();
  elements.documentTitle.textContent = mode === 'resume' ? 'Resume 편집' : mode === 'series' ? '시리즈 관리' : mode === 'categories' ? '카테고리 관리' : (elements.title.value || '글 목록');
  if (mode === 'resume' && !state.resume) void loadResume();
  if (mode === 'series') void loadSeries();
  if (mode === 'categories') void loadCategories();
  if (mode === 'posts') {
    const initialSlug = resolveInitialPostSlug(state.posts, localStorage.getItem(LAST_POST_STORAGE_KEY));
    if (!hasPost && initialSlug) await selectPost(initialSlug);
    else if (!hasPost) elements.emptyState.hidden = false;
    else updateDocumentHeader();
  }
}

const input = (label, path, value = '', multiline = false) => `<label class="field"><span>${label}</span>${multiline ? `<textarea rows="3" data-path="${path}">${escapeHtml(value)}</textarea>` : `<input data-path="${path}" value="${escapeHtml(value)}" />`}</label>`;
const itemActions = (path, index) => `<div class="item-actions"><button type="button" data-move="-1" data-array="${path}" data-index="${index}" aria-label="위로">↑</button><button type="button" data-move="1" data-array="${path}" data-index="${index}" aria-label="아래로">↓</button><button type="button" data-remove data-array="${path}" data-index="${index}" aria-label="삭제">×</button></div>`;

function renderResume() {
  const { profile, sections } = state.resume;
  elements.resumeProfile.innerHTML = input('Eyebrow', 'profile.eyebrow', profile.eyebrow) + input('이름', 'profile.name', profile.name) + input('소개', 'profile.description', profile.description, true) +
    `<div class="nested-block"><div class="nested-title"><strong>연락처</strong><button type="button" data-add="contact" data-array="profile.contacts">추가</button></div>${profile.contacts.map((contact, index) => `<div class="form-row">${input('표시 이름', `profile.contacts.${index}.label`, contact.label)}${input('URL', `profile.contacts.${index}.url`, contact.url)}${itemActions('profile.contacts', index)}</div>`).join('')}</div>`;
  elements.resumeSections.innerHTML = sections.map((section, sectionIndex) => {
    const base = `sections.${sectionIndex}`;
    let body = input('섹션 제목', `${base}.title`, section.title) + input('부가 설명', `${base}.note`, section.note || '');
    if (section.type === 'prose') body += renderSimpleArray(section.paragraphs || [], `${base}.paragraphs`, '문단', 'paragraph');
    if (section.type === 'list') body += `<div class="nested-block"><div class="nested-title"><strong>목록</strong><button type="button" data-add="listItem" data-array="${base}.items">항목 추가</button></div>${(section.items || []).map((item, i) => `<div class="form-row">${input('강조 제목', `${base}.items.${i}.title`, item.title)}${input('내용', `${base}.items.${i}.detail`, item.detail, true)}${itemActions(`${base}.items`, i)}</div>`).join('')}</div>`;
    if (section.type === 'keyValue') body += `<div class="nested-block"><div class="nested-title"><strong>행</strong><button type="button" data-add="row" data-array="${base}.rows">행 추가</button></div>${(section.rows || []).map((row, i) => `<div class="form-row">${input('항목', `${base}.rows.${i}.label`, row.label)}${input('내용', `${base}.rows.${i}.value`, row.value, true)}${itemActions(`${base}.rows`, i)}</div>`).join('')}</div>`;
    if (section.type === 'timeline') body += `<div class="nested-block"><div class="nested-title"><strong>그룹</strong><button type="button" data-add="group" data-array="${base}.groups">그룹 추가</button></div>${(section.groups || []).map((group, gi) => renderTimelineGroup(group, base, gi)).join('')}</div>`;
    return `<article class="structured-card section-card"><header><span class="type-badge">${sectionTypeName(section.type)}</span>${itemActions('sections', sectionIndex)}</header>${body}</article>`;
  }).join('');
}

function renderSimpleArray(values, path, title, template) {
  return `<div class="nested-block"><div class="nested-title"><strong>${title}</strong><button type="button" data-add="${template}" data-array="${path}">추가</button></div>${values.map((value, i) => `<div class="form-row">${input(title, `${path}.${i}`, value, true)}${itemActions(path, i)}</div>`).join('')}</div>`;
}
function renderTimelineGroup(group, base, gi) {
  const path = `${base}.groups.${gi}`;
  return `<div class="nested-card">${itemActions(`${base}.groups`, gi)}${input('그룹명', `${path}.title`, group.title)}${input('설명', `${path}.summary`, group.summary)}${input('기간', `${path}.period`, group.period)}<div class="nested-block"><div class="nested-title"><strong>타임라인 항목</strong><button type="button" data-add="timelineItem" data-array="${path}.items">항목 추가</button></div>${(group.items || []).map((item, ii) => {
    const itemPath = `${path}.items.${ii}`;
    return `<div class="nested-card">${itemActions(`${path}.items`, ii)}${input('제목', `${itemPath}.title`, item.title)}${input('설명', `${itemPath}.summary`, item.summary)}${input('기간', `${itemPath}.period`, item.period)}${renderSimpleArray(item.highlights || [], `${itemPath}.highlights`, '성과', 'paragraph')}${input('기술', `${itemPath}.tech`, item.tech)}</div>`;
  }).join('')}</div></div>`;
}
function sectionTypeName(type) { return ({ prose: '일반 글', timeline: '타임라인', list: '글머리 목록', keyValue: '키-값 표' })[type]; }

function getAt(path) { return path.split('.').reduce((value, key) => value[key], state.resume); }
function setAt(path, value) { const keys = path.split('.'); const last = keys.pop(); const target = keys.reduce((item, key) => item[key], state.resume); target[last] = value; }
function resumeChanged() { state.dirty = true; elements.saveStatus.textContent = '저장하지 않음'; elements.saveStatus.classList.add('is-dirty'); }

elements.resumeScreen.addEventListener('input', (event) => { if (event.target.dataset.path) { setAt(event.target.dataset.path, event.target.value); resumeChanged(); } });
elements.resumeScreen.addEventListener('click', (event) => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.add) { getAt(button.dataset.array).push(templateValue(button.dataset.add)); renderResume(); resumeChanged(); }
  if (button.hasAttribute('data-remove')) { getAt(button.dataset.array).splice(Number(button.dataset.index), 1); renderResume(); resumeChanged(); }
  if (button.dataset.move) { const array = getAt(button.dataset.array); const from = Number(button.dataset.index); const to = from + Number(button.dataset.move); if (to >= 0 && to < array.length) { [array[from], array[to]] = [array[to], array[from]]; renderResume(); resumeChanged(); } }
});
function templateValue(type) {
  return ({ contact: { label: '', url: '' }, paragraph: '', listItem: { title: '', detail: '' }, row: { label: '', value: '' }, group: { title: '', summary: '', period: '', items: [] }, timelineItem: { title: '', summary: '', period: '', highlights: [], tech: '' } })[type];
}
function addResumeSection() {
  const type = elements.newSectionType.value;
  const section = { type, title: '새 섹션', note: '' };
  if (type === 'prose') section.paragraphs = [];
  if (type === 'timeline') section.groups = [];
  if (type === 'list') section.items = [];
  if (type === 'keyValue') section.rows = [];
  state.resume.sections.push(section); renderResume(); resumeChanged();
}
async function loadResume() {
  try { const result = await api('/api/resume'); state.resume = result.data; state.resumeRevision = result.revision; renderResume(); markClean(); }
  catch (error) { showToast(error.message, true); }
}
async function saveResume() {
  try { const result = await api('/api/resume', { method: 'PUT', body: JSON.stringify({ data: state.resume, revision: state.resumeRevision }) }); state.resume = result.data; state.resumeRevision = result.revision; markClean(); showToast('Resume를 저장했습니다.'); }
  catch (error) { showToast(error.message, true); }
}

function renderSeriesList() {
  elements.seriesList.innerHTML = state.series.map((item) => `<button type="button" data-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title)}</strong><span>${state.posts.filter((post) => post.series === item.id).length}개 글</span></button>`).join('') || '<p>아직 시리즈가 없습니다.</p>';
  elements.seriesList.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => editSeries(button.dataset.id)));
}
function beginNewSeries() {
  if (!confirmDiscard()) return;
  markClean();
  state.currentSeries = null; elements.seriesForm.hidden = false; elements.seriesId.readOnly = false; elements.seriesId.value = ''; elements.seriesTitle.value = ''; elements.seriesDescription.value = ''; elements.seriesFormTitle.textContent = '새 시리즈'; elements.deleteSeries.hidden = true;
}
function editSeries(id) {
  if (state.dirty && !confirmDiscard()) return;
  markClean();
  const item = state.series.find((series) => series.id === id); state.currentSeries = item; elements.seriesForm.hidden = false; elements.seriesId.value = item.id; elements.seriesId.readOnly = true; elements.seriesTitle.value = item.title; elements.seriesDescription.value = item.description; elements.seriesFormTitle.textContent = item.title; elements.deleteSeries.hidden = false;
}
async function saveSeries() {
  try {
    const payload = { id: elements.seriesId.value.trim(), title: elements.seriesTitle.value.trim(), description: elements.seriesDescription.value.trim(), revision: state.currentSeries?.revision };
    const saved = await api(state.currentSeries ? `/api/series/${encodeURIComponent(state.currentSeries.id)}` : '/api/series', { method: state.currentSeries ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    await loadSeries(); markClean(); editSeries(saved.id); showToast('시리즈를 저장했습니다.');
  } catch (error) { showToast(error.message, true); }
}
async function deleteSeries() {
  if (!state.currentSeries || !window.confirm('이 시리즈를 삭제할까요?')) return;
  try { await api(`/api/series/${encodeURIComponent(state.currentSeries.id)}`, { method: 'DELETE' }); elements.seriesForm.hidden = true; markClean(); await loadSeries(); showToast('시리즈를 삭제했습니다.'); }
  catch (error) { showToast(error.message, true); }
}

elements.seriesForm.addEventListener('input', () => { state.dirty = true; elements.saveStatus.textContent = '저장하지 않음'; elements.saveStatus.classList.add('is-dirty'); });

async function loadCategories() {
  try {
    const result = await api('/api/categories');
    state.categories = result.categories.map((item) => ({
      ...item,
      _originalName: item.name,
      _subOriginals: [...item.subcategories],
    }));
    state.categoryRevision = result.revision;
    state.categoryMigrations = [];
    renderTaxonomyOptions();
    renderCategoryManager();
  } catch (error) { showToast(error.message, true); }
}

function categoryChanged() {
  state.dirty = true;
  elements.saveStatus.textContent = '저장하지 않음';
  elements.saveStatus.classList.add('is-dirty');
  renderTaxonomyOptions();
}

function renderCategoryManager() {
  elements.categoryList.innerHTML = state.categories.map((category, categoryIndex) => `
    <article class="category-manage-card" data-category-index="${categoryIndex}">
      <div class="category-manage-row">
        <label class="field"><span>카테고리 이름</span><input data-category-name value="${escapeHtml(category.name)}" required /></label>
        <div class="category-actions"><button class="button" type="button" data-add-subcategory>하위 추가</button><button class="button button--danger" type="button" data-delete-category>삭제</button></div>
      </div>
      <div class="subcategory-manage-list">${category.subcategories.map((name, subcategoryIndex) => `
        <div class="subcategory-manage-row" data-subcategory-index="${subcategoryIndex}">
          <label class="field"><span>하위 카테고리</span><input data-subcategory-name value="${escapeHtml(name)}" required /></label>
          <button class="button button--danger" type="button" data-delete-subcategory>삭제</button>
        </div>`).join('') || '<small>하위 카테고리가 없습니다.</small>'}</div>
    </article>`).join('') || '<p>아직 카테고리가 없습니다.</p>';
}

function addCategory() {
  state.categories.push({ name: '새 카테고리', subcategories: [], _originalName: null, _subOriginals: [] });
  renderCategoryManager(); categoryChanged();
}

elements.categoryList.addEventListener('input', (event) => {
  const card = event.target.closest('[data-category-index]');
  if (!card) return;
  const category = state.categories[Number(card.dataset.categoryIndex)];
  if (event.target.matches('[data-category-name]')) category.name = event.target.value;
  if (event.target.matches('[data-subcategory-name]')) category.subcategories[Number(event.target.closest('[data-subcategory-index]').dataset.subcategoryIndex)] = event.target.value;
  categoryChanged();
});

elements.categoryList.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  const card = event.target.closest('[data-category-index]');
  if (!button || !card) return;
  const categoryIndex = Number(card.dataset.categoryIndex);
  const category = state.categories[categoryIndex];
  if (button.hasAttribute('data-add-subcategory')) {
    category.subcategories.push('새 하위 카테고리'); category._subOriginals.push(null);
  }
  if (button.hasAttribute('data-delete-subcategory')) {
    const subcategoryIndex = Number(button.closest('[data-subcategory-index]').dataset.subcategoryIndex);
    const original = category._subOriginals[subcategoryIndex];
    if (original && state.posts.some((post) => post.category === category._originalName && post.subcategory === original)) {
      if (!window.confirm(`'${original}'의 글을 상위 카테고리로 이동하고 삭제할까요?`)) return;
      state.categoryMigrations.push({ category: category._originalName, subcategory: original, targetCategory: category.name, targetSubcategory: '' });
    }
    category.subcategories.splice(subcategoryIndex, 1); category._subOriginals.splice(subcategoryIndex, 1);
  }
  if (button.hasAttribute('data-delete-category')) {
    if (category._originalName && state.posts.some((post) => post.category === category._originalName)) {
      const target = window.prompt(`'${category._originalName}'의 글을 이동할 다른 카테고리 이름을 입력하세요.`)?.trim();
      if (!target || !state.categories.some((item, index) => index !== categoryIndex && item.name === target)) { showToast('유효한 이동 대상 카테고리가 필요합니다.', true); return; }
      state.categoryMigrations.push({ category: category._originalName, targetCategory: target, preserveSubcategory: false });
    } else if (!window.confirm(`'${category.name}' 카테고리를 삭제할까요?`)) return;
    state.categories.splice(categoryIndex, 1);
  }
  renderCategoryManager(); categoryChanged();
});

async function saveCategories() {
  try {
    const migrations = [...state.categoryMigrations];
    for (const category of state.categories) {
      if (category._originalName && category._originalName !== category.name.trim()) {
        migrations.push({ category: category._originalName, targetCategory: category.name.trim(), preserveSubcategory: true });
      }
      category.subcategories.forEach((name, index) => {
        const original = category._subOriginals[index];
        if (original && original !== name.trim()) migrations.push({
          category: category.name.trim(), subcategory: original,
          targetCategory: category.name.trim(), targetSubcategory: name.trim(),
        });
      });
    }
    const payload = {
      categories: state.categories.map((item) => ({ name: item.name.trim(), subcategories: item.subcategories.map((name) => name.trim()) })),
      revision: state.categoryRevision,
      migrations,
    };
    await api('/api/categories', { method: 'PUT', body: JSON.stringify(payload) });
    await Promise.all([loadCategories(), loadPostList()]);
    if (state.currentSlug) {
      const current = await api(`/api/posts/${encodeURIComponent(state.currentSlug)}`);
      state.revision = current.revision;
      setForm(current.slug, current.metadata, false);
    }
    markClean(); showToast('카테고리와 연결된 글을 저장했습니다.');
  } catch (error) { showToast(error.message, true); }
}

await Promise.all([loadPostList(), loadSeries(), loadCategories()]);
const initialSlug = resolveInitialPostSlug(state.posts, localStorage.getItem(LAST_POST_STORAGE_KEY));
if (initialSlug) {
  await selectPost(initialSlug);
} else {
  elements.documentTitle.textContent = '작성한 글이 없습니다';
  elements.emptyState.querySelector('h2').textContent = '아직 작성한 글이 없습니다';
  elements.emptyState.querySelector('p').textContent = '왼쪽 위 ＋ 버튼으로 첫 글을 작성할 수 있습니다.';
  elements.emptyState.hidden = false;
}
