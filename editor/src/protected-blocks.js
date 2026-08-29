export function extractProtectedBlocks(markdown) {
  const blocks = [];
  const protectedMarkdown = markdown.replace(/^<details>\r?\n[\s\S]*?^<\/details>[ \t]*$/gm, (raw) => {
    const token = `BLOG_DETAILS_BLOCK_${blocks.length + 1}`;
    blocks.push({ token, raw });
    return `\`\`\`blog-details\n${token}\n\`\`\``;
  });
  return { markdown: protectedMarkdown, blocks };
}

export function restoreProtectedBlocks(markdown, blocks) {
  let restored = markdown;
  blocks.forEach(({ token, raw }) => {
    const pattern = new RegExp(`\\\`\\\`\\\`blog-details\\s*\\n${token}\\s*\\n\\\`\\\`\\\``, 'g');
    restored = restored.replace(pattern, raw);
  });
  return restored;
}
