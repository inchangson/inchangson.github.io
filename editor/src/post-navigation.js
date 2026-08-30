export const POST_VIEWS = Object.freeze({
  all: 'all',
  series: 'series',
  category: 'category',
});

export function resolveInitialPostSlug(posts, storedSlug) {
  if (storedSlug && posts.some((post) => post.slug === storedSlug)) return storedSlug;
  return posts[0]?.slug || null;
}

export function filterPosts(posts, query) {
  const normalized = String(query || '').trim().toLocaleLowerCase('ko');
  if (!normalized) return [...posts];
  return posts.filter((post) =>
    [post.title, post.description, post.slug, post.category, ...(post.tags || [])]
      .join(' ')
      .toLocaleLowerCase('ko')
      .includes(normalized),
  );
}

export function groupPosts(posts, view, series) {
  if (view === POST_VIEWS.all) return [{ id: POST_VIEWS.all, label: '전체', posts: [...posts] }];

  const groups = new Map();
  posts.forEach((post) => {
    const id = view === POST_VIEWS.series ? post.series || '__unassigned__' : post.category || '__uncategorized__';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(post);
  });

  if (view === POST_VIEWS.series) {
    const titles = new Map(series.map((item) => [item.id, item.title]));
    return [...groups.entries()]
      .map(([id, items]) => ({
        id,
        label: id === '__unassigned__' ? '시리즈 없음' : titles.get(id) || id,
        posts: [...items].sort((a, b) =>
          (a.seriesOrder ?? Number.MAX_SAFE_INTEGER) - (b.seriesOrder ?? Number.MAX_SAFE_INTEGER)
          || b.pubDate.localeCompare(a.pubDate)
          || a.title.localeCompare(b.title, 'ko')),
      }))
      .sort((a, b) => {
        if (a.id === '__unassigned__') return 1;
        if (b.id === '__unassigned__') return -1;
        return a.label.localeCompare(b.label, 'ko');
      });
  }

  return [...groups.entries()]
    .map(([id, items]) => ({
      id,
      label: id === '__uncategorized__' ? '카테고리 없음' : id,
      posts: [...items].sort((a, b) => b.pubDate.localeCompare(a.pubDate) || a.title.localeCompare(b.title, 'ko')),
    }))
    .sort((a, b) => {
      if (a.id === '__uncategorized__') return 1;
      if (b.id === '__uncategorized__') return -1;
      return a.label.localeCompare(b.label, 'ko');
    });
}
