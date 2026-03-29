import type { FeedSource, Story } from '@news/shared';
import {
  FEED_SOURCES,
  buildSiteLabel,
  buildStoryId,
  pickRandomSubmitter,
  stripHtml,
} from '@news/shared';
import Parser from 'rss-parser';
import { syncSearchIndexFromStoriesTable } from './search';
import { upsertStory } from './stories';

type ParsedItem = {
  title?: string;
  description?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
};

type RankedStory = Story & {
  sourcePriority: number;
};

const parser = new Parser<Record<string, never>, ParsedItem>();
const feedRequestBatchSize = 20;
const feedRequestTimeoutMs = 10_000;

const categoryPriority: Record<FeedSource['category'], number> = {
  'hacker-news': 3,
  rationalist: 2,
  'tech-blog': 1,
};

const normalizeUrl = (url: string): string => {
  const parsed = new URL(url);

  for (const key of [...parsed.searchParams.keys()]) {
    if (key.startsWith('utm_') || key === 'ref') {
      parsed.searchParams.delete(key);
    }
  }

  parsed.hash = '';
  return parsed.toString();
};

const summarizeText = (value: string | undefined, limit: number): string | null => {
  if (!value) {
    return null;
  }

  const clean = stripHtml(value).trim();
  if (!clean) {
    return null;
  }

  return clean.slice(0, limit);
};

const extractStoryContent = (source: FeedSource, item: ParsedItem) => {
  const rawContent = item.content ?? item.contentSnippet ?? item.description;
  if (!rawContent) {
    return undefined;
  }

  if (source.key !== 'hn-frontpage') {
    return rawContent;
  }

  return rawContent.replace(/<hr[\s\S]*$/i, '').trim();
};

const buildRankingScore = (publishedAt: string): number => new Date(publishedAt).getTime();

const withTimeout = async <TValue>(
  promise: Promise<TValue>,
  timeoutMs: number,
  sourceUrl: string,
): Promise<TValue> =>
  new Promise<TValue>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timed out loading ${sourceUrl}.`));
    }, timeoutMs);

    void promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });

const normalizeStory = (source: FeedSource, item: ParsedItem): RankedStory | null => {
  if (!item.title) {
    return null;
  }

  const rawUrl = item.link;
  if (!rawUrl) {
    return null;
  }

  let canonicalUrl: string;
  try {
    canonicalUrl = normalizeUrl(rawUrl);
  } catch {
    return null;
  }

  if (source.key === 'hn-frontpage' && new URL(canonicalUrl).hostname === 'news.ycombinator.com') {
    return null;
  }

  const publishedAt = item.isoDate ?? item.pubDate ?? new Date().toISOString();
  const normalizedPublishedAt = new Date(publishedAt).toISOString();
  const { siteLabel, siteUrl } = buildSiteLabel(canonicalUrl);
  const storyId = buildStoryId(source.key, canonicalUrl);
  const seedInput = `${source.key}:${canonicalUrl}`;
  const storyContent = extractStoryContent(source, item);

  return {
    id: storyId,
    title: item.title,
    url: canonicalUrl,
    siteLabel,
    siteUrl,
    sourceKey: source.key,
    sourceTitle: source.title,
    sourceCategory: source.category,
    submittedBy: pickRandomSubmitter(seedInput),
    publishedAt: normalizedPublishedAt,
    storyText: summarizeText(storyContent, 1_000),
    summary: summarizeText(storyContent, 280),
    commentCount: 0,
    rankingScore: buildRankingScore(normalizedPublishedAt),
    sourcePriority: categoryPriority[source.category],
  };
};

const fetchStoriesForSource = async (source: FeedSource): Promise<RankedStory[]> => {
  try {
    const feed = await withTimeout(parser.parseURL(source.url), feedRequestTimeoutMs, source.url);
    const resolvedSource =
      source.autoTitle && feed.title?.trim() ? { ...source, title: feed.title.trim() } : source;

    return feed.items
      .slice(0, 24)
      .map((item) => normalizeStory(resolvedSource, item))
      .filter((story): story is RankedStory => story !== null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown feed failure.';
    console.warn(`Skipping feed ${source.url}: ${message}`);
    return [];
  }
};

export const refreshStoriesFromRss = async () => {
  const normalizedByUrl = new Map<string, RankedStory>();

  for (let idx = 0; idx < FEED_SOURCES.length; idx += feedRequestBatchSize) {
    const batch = FEED_SOURCES.slice(idx, idx + feedRequestBatchSize);
    const storiesBySource = await Promise.all(batch.map(fetchStoriesForSource));

    for (const stories of storiesBySource) {
      for (const normalized of stories) {
        const existing = normalizedByUrl.get(normalized.url);
        if (!existing || normalized.sourcePriority > existing.sourcePriority) {
          normalizedByUrl.set(normalized.url, normalized);
        }
      }
    }
  }

  const stories = [...normalizedByUrl.values()].sort(
    (left, right) => right.rankingScore - left.rankingScore,
  );

  await Promise.all(
    stories.map(async ({ sourcePriority: _sourcePriority, ...story }) => upsertStory(story)),
  );

  const indexedStoryCount = await syncSearchIndexFromStoriesTable();

  return {
    storyCount: stories.length,
    indexedStoryCount,
  };
};
