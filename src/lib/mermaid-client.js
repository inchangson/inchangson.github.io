let mermaidPromise;
const renderVersions = new WeakMap();
const blockTasks = new WeakMap();

export function createSequentialRenderQueue(render) {
  let pending = Promise.resolve();
  let sequence = 0;

  return (source, scope = 'diagram') => {
    sequence += 1;
    const safeScope = String(scope).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'diagram';
    const id = `mermaid-${safeScope}-${sequence}`;
    const task = pending.then(() => render(id, source));
    pending = task.catch(() => undefined);
    return task;
  };
}

async function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', suppressErrorRendering: true });
      return mermaid;
    }).catch((error) => {
      mermaidPromise = undefined;
      const failure = new Error('Mermaid 파일을 불러오지 못했습니다. 작성 중인 내용을 저장한 뒤 페이지를 새로고침해 주세요.', { cause: error });
      failure.name = 'MermaidLoadError';
      throw failure;
    });
  }
  return mermaidPromise;
}

const queuedRender = createSequentialRenderQueue(async (id, source) => {
  const mermaid = await loadMermaid();
  try {
    return { id, ...(await mermaid.render(id, source)) };
  } finally {
    // Mermaid can leave its temporary body container behind after a failure.
    document.getElementById(`d${id}`)?.remove();
  }
});

export async function renderMermaidSource(container, source, scope = 'diagram') {
  const version = (renderVersions.get(container) || 0) + 1;
  renderVersions.set(container, version);
  delete container.dataset.mermaidId;
  container.classList.remove('is-error');
  container.classList.add('is-loading');
  container.setAttribute('aria-busy', 'true');
  container.textContent = 'Mermaid 렌더링 중…';
  try {
    const result = await queuedRender(source, scope);
    if (renderVersions.get(container) !== version) return { ok: false, superseded: true };
    container.innerHTML = result.svg;
    result.bindFunctions?.(container);
    container.dataset.mermaidId = result.id;
    return { ok: true, id: result.id };
  } catch (error) {
    if (renderVersions.get(container) !== version) return { ok: false, superseded: true };
    container.classList.add('is-error');
    container.textContent = `Mermaid 다이어그램을 렌더링하지 못했습니다.\n${error.message || String(error)}`;
    if (error.name === 'MermaidLoadError') container.append(createReloadButton());
    return { ok: false, error };
  } finally {
    if (renderVersions.get(container) === version) {
      container.classList.remove('is-loading');
      container.removeAttribute('aria-busy');
    }
  }
}

export async function renderMermaidCodeBlocks(root, options = {}) {
  const selector = options.selector || 'pre[data-language="mermaid"] > code, pre > code.language-mermaid';
  const scope = options.scope || 'page';
  const blocks = [...root.querySelectorAll(selector)];
  const results = [];

  for (const [index, block] of blocks.entries()) {
    if (blockTasks.has(block)) {
      results.push(await blockTasks.get(block));
      continue;
    }
    if (!root.contains(block)) continue;
    const task = renderBlock(block, `${scope}-${index + 1}`);
    blockTasks.set(block, task);
    try {
      results.push(await task);
    } finally {
      blockTasks.delete(block);
    }
  }
  return results;
}

async function renderBlock(block, scope) {
  const source = block.textContent || '';
  const pre = block.parentElement;
  if (!pre) return { ok: false, superseded: true };
  const container = document.createElement('div');
  container.className = 'mermaid mermaid-preview';
  // Toast UI uses this identity to replace edited Markdown preview nodes.
  if (pre.dataset.nodeid) container.dataset.nodeid = pre.dataset.nodeid;
  const result = await renderMermaidSource(container, source, scope);
  pre.nextElementSibling?.classList.contains('mermaid-render-error') && pre.nextElementSibling.remove();
  if (result.ok) {
    pre.replaceWith(container);
  } else {
    pre.classList.add('mermaid-source-error');
    const message = document.createElement('p');
    message.className = 'mermaid-render-error';
    message.textContent = result.error?.name === 'MermaidLoadError'
      ? result.error.message
      : '다이어그램 렌더링에 실패해 Mermaid 원문을 표시합니다.';
    if (result.error?.name === 'MermaidLoadError') message.append(createReloadButton());
    message.title = result.error?.message || '';
    pre.after(message);
    console.error('Mermaid diagram rendering failed.', result.error);
  }
  return result;
}

function createReloadButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '페이지 새로고침';
  button.addEventListener('click', () => window.location.reload());
  return button;
}
