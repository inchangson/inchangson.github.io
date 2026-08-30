import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import '@toast-ui/editor/dist/i18n/ko-kr';
import { extractProtectedBlocks, restoreProtectedBlocks } from './protected-blocks.js';
import './style.css';

const elements = {
  postList: document.querySelector('#post-list'),
  postSidebar: document.querySelector('#post-sidebar'),
  navPosts: document.querySelector('#nav-posts'),
  navResume: document.querySelector('#nav-resume'),
  navSeries: document.querySelector('#nav-series'),
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
  category: document.querySelector('#category'),
  categoryOptions: document.querySelector('#category-options'),
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
  resume: null,
  resumeRevision: null,
  currentSeries: null,
  mode: 'posts',
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
  elements.category,
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
elements.newPost.addEventListener('click', beginNewPost);
elements.emptyNewPost.addEventListener('click', beginNewPost);
elements.save.addEventListener('click', saveCurrentPost);
elements.htmlButton.addEventListener('click', openHtmlBlocksDialog);
elements.applyHtml.addEventListener('click', applyHtmlBlocks);
elements.navPosts.addEventListener('click', () => switchMode('posts'));
elements.navResume.addEventListener('click', () => void switchMode('resume'));
elements.navSeries.addEventListener('click', () => void switchMode('series'));
elements.tags.addEventListener('keydown', handleTagInput);
elements.tags.addEventListener('blur', commitTagInput);
elements.series.addEventListener('change', updateSeriesFields);
elements.saveResume.addEventListener('click', () => void saveResume());
elements.addSection.addEventListener('click', addResumeSection);
elements.newSeries.addEventListener('click', beginNewSeries);
elements.seriesForm.addEventListener('submit', (event) => { event.preventDefault(); void saveSeries(); });
elements.deleteSeries.addEventListener('click', () => void deleteSeries());

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
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
  const query = elements.search.value.trim().toLocaleLowerCase('ko');
  const filtered = state.posts.filter((post) =>
    [post.title, post.description, post.slug, post.category, ...(post.tags || [])].join(' ').toLocaleLowerCase('ko').includes(query),
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
      <span class="post-item__meta"><span>${escapeHtml(post.pubDate)}</span><span>${post.draft ? '초안' : escapeHtml(post.category || '게시됨')}</span></span>
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
  setForm('', { title: '', description: '', pubDate: localToday, updatedDate: '', category: '', tags: [], series: '', draft: true }, true);
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
    category: elements.category.value.trim(),
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

function renderTaxonomyOptions() {
  const categories = [...new Set(state.posts.map((post) => post.category).filter(Boolean))].sort();
  const tags = [...new Set(state.posts.flatMap((post) => post.tags || []))].sort();
  elements.categoryOptions.innerHTML = categories.map((value) => `<option value="${escapeHtml(value)}"></option>`).join('');
  elements.tagOptions.innerHTML = tags.map((value) => `<option value="${escapeHtml(value)}"></option>`).join('');
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
}

function switchMode(mode) {
  if (!confirmDiscard()) return;
  markClean();
  state.mode = mode;
  [elements.navPosts, elements.navResume, elements.navSeries].forEach((button) => button.classList.remove('is-active'));
  elements[`nav${mode[0].toUpperCase()}${mode.slice(1)}`]?.classList.add('is-active');
  elements.postSidebar.hidden = mode !== 'posts';
  const hasPost = Boolean(state.currentSlug || state.isNew);
  elements.editorScreen.hidden = mode !== 'posts' || !hasPost;
  elements.resumeScreen.hidden = mode !== 'resume';
  elements.seriesScreen.hidden = mode !== 'series';
  elements.save.hidden = mode !== 'posts';
  elements.previewLink.hidden = mode === 'series';
  elements.previewLink.href = mode === 'resume' ? 'http://localhost:4321/resume' : elements.previewLink.href;
  elements.previewLink.classList.toggle('is-disabled', mode === 'series');
  elements.emptyState.hidden = mode !== 'posts' || hasPost;
  elements.documentKind.textContent = mode === 'posts' ? 'DOCUMENTS' : mode.toUpperCase();
  elements.documentTitle.textContent = mode === 'resume' ? 'Resume 편집' : mode === 'series' ? '시리즈 관리' : (elements.title.value || '글 목록');
  if (mode === 'resume' && !state.resume) void loadResume();
  if (mode === 'series') void loadSeries();
  if (mode === 'posts') updateDocumentHeader();
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

await Promise.all([loadPostList(), loadSeries()]);
