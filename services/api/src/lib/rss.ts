import type { FeedSource, Story } from '@news/shared';
import {
  FEED_SOURCES,
  buildSiteLabel,
  buildStoryId,
  pickRandomPoints,
  pickRandomSubmitter,
  stripHtml,
} from '@news/shared';
import Parser from 'rss-parser';
import { upsertStory } from './stories';

type ParsedItem = {
  title?: string;
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

const buildRankingScore = (source: FeedSource, publishedAt: string, points: number): number => {
  const publishedAtMs = new Date(publishedAt).getTime();
  return (
    categoryPriority[source.category] * 10_000_000_000_000 + points * 10_000_000_000 + publishedAtMs
  );
};

const normalizeStory = (source: FeedSource, item: ParsedItem): RankedStory | null => {
  if (!item.title) {
    return null;
  }

  const rawUrl = item.link ?? item.guid;
  if (!rawUrl) {
    return null;
  }

  let canonicalUrl: string;
  try {
    canonicalUrl = normalizeUrl(rawUrl);
  } catch {
    return null;
  }

  const publishedAt = item.isoDate ?? item.pubDate ?? new Date().toISOString();
  const { siteLabel, siteUrl } = buildSiteLabel(canonicalUrl);
  const storyId = buildStoryId(source.key, canonicalUrl);
  const seedInput = `${source.key}:${canonicalUrl}`;
  const points = pickRandomPoints(seedInput);

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
    points,
    publishedAt: new Date(publishedAt).toISOString(),
    storyText: summarizeText(item.content, 1_000),
    summary: summarizeText(item.contentSnippet ?? item.content, 280),
    commentCount: 0,
    rankingScore: buildRankingScore(source, publishedAt, points),
    sourcePriority: categoryPriority[source.category],
  };
};

export const refreshStoriesFromRss = async () => {
  const normalizedByUrl = new Map<string, RankedStory>();

  for (const source of FEED_SOURCES) {
    const feed = await parser.parseURL(source.url);

    for (const item of feed.items.slice(0, 24)) {
      const normalized = normalizeStory(source, item);
      if (!normalized) {
        continue;
      }

      const existing = normalizedByUrl.get(normalized.url);
      if (!existing || normalized.sourcePriority > existing.sourcePriority) {
        normalizedByUrl.set(normalized.url, normalized);
      }
    }
  }

  const stories = [...normalizedByUrl.values()]
    .sort((left, right) => right.rankingScore - left.rankingScore)
    .slice(0, 80);

  await Promise.all(
    stories.map(async ({ sourcePriority: _sourcePriority, ...story }) => upsertStory(story)),
  );

  return stories.length;
};
