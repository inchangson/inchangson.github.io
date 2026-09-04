import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePastedHtml } from './paste-normalizer.js';

test('keeps Confluence pre/code line breaks, indentation, and language', () => {
  const html = '<pre data-language="yaml"><code>spec:<br>  containers:<br>    - name: web</code></pre>';
  assert.equal(normalizePastedHtml(html), '<pre data-language="yaml"><code class="language-yaml">spec:\n  containers:\n    - name: web</code></pre>');
});

test('converts line spans in a Confluence code container', () => {
  const html = '<div class="codeContent" data-language="bash"><span>kubectl get pods</span><span>  kubectl describe pod web</span></div>';
  assert.equal(normalizePastedHtml(html), '<pre data-language="bash"><code class="language-bash">kubectl get pods\n  kubectl describe pod web</code></pre>');
});

test('leaves a single-line inline code element alone', () => {
  assert.equal(normalizePastedHtml('<p>Use <code>kubectl get pods</code>.</p>'), '<p>Use <code>kubectl get pods</code>.</p>');
});

test('promotes multiline code while preserving surrounding paragraphs', () => {
  const html = '<p>Before</p><code class="language-sh">one<br>  two</code><p>After</p>';
  assert.equal(normalizePastedHtml(html), '<p>Before</p><pre data-language="sh"><code class="language-sh">one\n  two</code></pre><p>After</p>');
});
