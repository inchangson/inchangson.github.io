import { getCollection, type CollectionEntry } from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;
export type SeriesEntry = CollectionEntry<'series'>;

export interface BlogQueryOptions {
  includeDrafts?: boolean;
}

export async function getBlogPosts({ includeDrafts = import.meta.env.DEV }: BlogQueryOptions = {}) {
  return (await getCollection('posts'))
    .filter((post) => includeDrafts || !post.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function bySeriesOrder(posts: PostEntry[]) {
  return [...posts].sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0));
}

export async function getBlogSeries(options: BlogQueryOptions = {}) {
  const [posts, series] = await Promise.all([getBlogPosts(options), getCollection('series')]);
  return series
    .map((entry) => ({ entry, posts: bySeriesOrder(posts.filter((post) => post.data.series === entry.id)) }))
    .filter((item) => item.posts.length > 0)
    .sort((a, b) => a.entry.data.title.localeCompare(b.entry.data.title, 'ko'));
}

export function taxonomyValues(posts: PostEntry[], key: 'category' | 'tags') {
  const values = key === 'category' ? posts.map((post) => post.data.category) : posts.flatMap((post) => post.data.tags);
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ko'));
}

export function subcategoryValues(posts: PostEntry[], category: string) {
  return [...new Set(posts.filter((post) => post.data.category === category).map((post) => post.data.subcategory).filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b, 'ko'));
}
