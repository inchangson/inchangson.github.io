let mermaidPromise;

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
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
      return mermaid;
    });
  }
  return mermaidPromise;
}

const queuedRender = createSequentialRenderQueue(async (id, source) => {
  const mermaid = await loadMermaid();
  return { id, ...(await mermaid.render(id, source)) };
});

export async function renderMermaidSource(container, source, scope = 'diagram') {
  container.classList.remove('is-error');
  container.classList.add('is-loading');
  container.setAttribute('aria-busy', 'true');
  container.textContent = 'Mermaid 렌더링 중…';
  try {
    const result = await queuedRender(source, scope);
    container.innerHTML = result.svg;
    result.bindFunctions?.(container);
    container.dataset.mermaidId = result.id;
    return { ok: true, id: result.id };
  } catch (error) {
    container.classList.add('is-error');
    container.textContent = 'Mermaid 다이어그램을 렌더링하지 못했습니다.';
    return { ok: false, error };
  } finally {
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');
  }
}

export async function renderMermaidCodeBlocks(root, options = {}) {
  const selector = options.selector || 'pre[data-language="mermaid"] > code, pre > code.language-mermaid';
  const scope = options.scope || 'page';
  const blocks = [...root.querySelectorAll(selector)];
  const results = [];

  for (const [index, block] of blocks.entries()) {
    const source = block.textContent || '';
    const pre = block.parentElement;
    if (!pre) continue;
    const container = document.createElement('div');
    container.className = 'mermaid mermaid-preview';
    const result = await renderMermaidSource(container, source, `${scope}-${index + 1}`);
    results.push(result);
    if (result.ok) {
      pre.replaceWith(container);
    } else {
      pre.classList.add('mermaid-source-error');
      pre.nextElementSibling?.classList.contains('mermaid-render-error') && pre.nextElementSibling.remove();
      const message = document.createElement('p');
      message.className = 'mermaid-render-error';
      message.textContent = '다이어그램 렌더링에 실패해 Mermaid 원문을 표시합니다.';
      pre.after(message);
      console.error('Mermaid diagram rendering failed.', result.error);
    }
  }
  return results;
}
