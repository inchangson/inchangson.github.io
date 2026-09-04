const BLOCK_CONTAINER_PATTERN = /<(pre|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const MULTILINE_CODE_PATTERN = /<code\b([^>]*)>([\s\S]*?)<\/code>/gi;

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function codeText(html) {
  let source = html.replace(/^\s*<code\b[^>]*>|<\/code>\s*$/gi, '');
  const usesLineSpans = !/<br\b/i.test(source) && (source.match(/<span\b/gi) || []).length > 1;
  source = source
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:div|p|li)>/gi, '\n');
  if (usesLineSpans) source = source.replace(/<\/span>/gi, '\n');
  return decodeHtml(source.replace(/<[^>]+>/g, ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/^\n+|\n+$/g, '');
}

function languageFrom(attributes) {
  const dataLanguage = attributes.match(/data-(?:language|syntax)=["']([^"']+)["']/i)?.[1];
  const classLanguage = attributes.match(/(?:language-|lang-|brush:\s*)([a-z0-9_+-]+)/i)?.[1];
  return (dataLanguage || classLanguage || '').toLowerCase().replace(/[^a-z0-9_+-]/g, '');
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function asCodeBlock(attributes, innerHtml) {
  const nestedCodeAttributes = innerHtml.match(/^\s*<code\b([^>]*)>/i)?.[1] || '';
  const language = languageFrom(`${attributes} ${nestedCodeAttributes}`);
  const className = language ? ` class="language-${language}"` : '';
  return `<pre${language ? ` data-language="${language}"` : ''}><code${className}>${escapeHtml(codeText(innerHtml))}</code></pre>`;
}

function isConfluenceCodeContainer(attributes) {
  return /(?:codeContent|code-block|syntaxhighlighter|code panel|code-container)/i.test(attributes);
}

export function normalizePastedHtml(html) {
  const normalizedBlocks = [];
  const blocks = html.replace(BLOCK_CONTAINER_PATTERN, (match, tag, attributes, innerHtml) => {
    if (tag.toLowerCase() !== 'pre' && !isConfluenceCodeContainer(attributes)) return match;
    const index = normalizedBlocks.push(asCodeBlock(attributes, innerHtml)) - 1;
    return `<!--normalized-code-${index}-->`;
  });

  return blocks.replace(MULTILINE_CODE_PATTERN, (match, attributes, innerHtml) => {
    const text = codeText(innerHtml);
    return text.includes('\n') ? asCodeBlock(attributes, innerHtml) : match;
  }).replace(/<!--normalized-code-(\d+)-->/g, (_, index) => normalizedBlocks[Number(index)]);
}

export function confluencePastePlugin(context) {
  return {
    wysiwygPlugins: [() => new context.pmState.Plugin({
      props: { transformPastedHTML: normalizePastedHtml },
    })],
  };
}
