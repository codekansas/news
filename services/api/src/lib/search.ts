import { defaultProvider } from '@aws-sdk/credential-provider-node';
import type { SearchStoriesPage, Story } from '@news/shared';
import { Client, errors } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws-v3';
import { env } from './env';
import { getStoriesByIds, listAllStories } from './stories';

type SearchDocument = {
  id: string;
  title: string;
  summary: string;
  storyText: string;
  siteLabel: string;
  sourceTitle: string;
  publishedAtMs: number;
};

const defaultPageSize = 30;
const maxPageSize = 30;
const indexBatchSize = 100;

let searchClient: Client | null = null;

const clampPageNumber = (value: number | undefined) => {
  if (!value || Number.isNaN(value)) {
    return 1;
  }

  return Math.max(1, Math.trunc(value));
};

const clampPageSize = (value: number | undefined) => {
  if (!value || Number.isNaN(value)) {
    return defaultPageSize;
  }

  return Math.max(1, Math.min(maxPageSize, Math.trunc(value)));
};

const getSearchClient = () => {
  if (searchClient) {
    return searchClient;
  }

  searchClient = new Client({
    ...AwsSigv4Signer({
      region: process.env.AWS_REGION ?? 'us-east-1',
      service: 'aoss',
      getCredentials: () => defaultProvider()(),
    }),
    node: env.searchCollectionEndpoint,
  });

  return searchClient;
};

const buildSearchDocument = (story: Story): SearchDocument => ({
  id: story.id,
  title: story.title,
  summary: story.summary ?? '',
  storyText: story.storyText ?? '',
  siteLabel: story.siteLabel,
  sourceTitle: story.sourceTitle,
  publishedAtMs: new Date(story.publishedAt).getTime(),
});

const isResponseError = (error: unknown): error is InstanceType<typeof errors.ResponseError> =>
  error instanceof errors.ResponseError;

const isMissingIndexError = (error: unknown) =>
  isResponseError(error) &&
  (error.statusCode === 404 ||
    JSON.stringify(error.meta.body).includes('index_not_found_exception'));

const ensureSearchIndex = async () => {
  const client = getSearchClient();

  try {
    await client.indices.create({
      index: env.searchIndexName,
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            title: { type: 'text' },
            summary: { type: 'text' },
            storyText: { type: 'text' },
            siteLabel: { type: 'text' },
            sourceTitle: { type: 'text' },
            publishedAtMs: { type: 'long' },
          },
        },
      },
    });
  } catch (error) {
    if (
      isResponseError(error) &&
      (error.statusCode === 400 || error.statusCode === 409) &&
      JSON.stringify(error.meta.body).includes('resource_already_exists_exception')
    ) {
      return;
    }

    throw error;
  }
};

const bulkIndexStories = async (stories: Story[]) => {
  const client = getSearchClient();

  for (let idx = 0; idx < stories.length; idx += indexBatchSize) {
    const batch = stories.slice(idx, idx + indexBatchSize);
    const operations = batch.flatMap((story) => [
      {
        index: {
          _index: env.searchIndexName,
          _id: story.id,
        },
      },
      buildSearchDocument(story),
    ]);

    const response = (await client.bulk({
      body: operations,
    })) as {
      body?: {
        errors?: boolean;
        items?: Array<{
          index?: {
            error?: {
              reason?: string;
              type?: string;
            };
          };
        }>;
      };
    };

    if (response.body?.errors) {
      const firstFailedItem = response.body.items?.find((item) => item.index?.error)?.index?.error;
      const errorDetail =
        firstFailedItem?.reason || firstFailedItem?.type || 'Unknown OpenSearch bulk failure.';
      throw new Error(`Failed to sync one or more search index documents: ${errorDetail}`);
    }
  }
};

export const syncSearchIndexFromStoriesTable = async () => {
  const stories = await listAllStories();
  await ensureSearchIndex();
  await bulkIndexStories(stories);
  return stories.length;
};

export const searchStoriesPage = async ({
  query,
  page,
  pageSize,
}: {
  query: string;
  page?: number;
  pageSize?: number;
}): Promise<SearchStoriesPage> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      query: '',
      stories: [],
      total: 0,
      hasMore: false,
    };
  }

  const safePage = clampPageNumber(page);
  const safePageSize = clampPageSize(pageSize);
  const from = (safePage - 1) * safePageSize;

  try {
    const client = getSearchClient();
    const response = (await client.search({
      index: env.searchIndexName,
      from,
      size: safePageSize,
      track_total_hits: true,
      body: {
        query: {
          bool: {
            should: [
              {
                multi_match: {
                  query: trimmedQuery,
                  fields: ['title^6', 'summary^4', 'storyText', 'siteLabel^2', 'sourceTitle^2'],
                  type: 'best_fields',
                },
              },
              {
                multi_match: {
                  query: trimmedQuery,
                  fields: ['title^10', 'summary^6'],
                  type: 'phrase',
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
        sort: [{ _score: 'desc' }, { publishedAtMs: 'desc' }],
      },
    })) as {
      body?: {
        hits?: {
          total?: number | { value: number };
          hits?: Array<{ _id?: string }>;
        };
      };
    };

    const storyIds = (response.body?.hits?.hits ?? [])
      .map((hit) => hit._id)
      .filter((storyId): storyId is string => Boolean(storyId));
    const storiesById = await getStoriesByIds(storyIds);
    const stories = storyIds
      .map((storyId) => storiesById.get(storyId))
      .filter((story): story is Story => story !== undefined);

    const totalHits = response.body?.hits?.total;
    const total = typeof totalHits === 'number' ? totalHits : (totalHits?.value ?? 0);

    return {
      query: trimmedQuery,
      stories,
      total,
      hasMore: from + stories.length < total,
    };
  } catch (error) {
    if (isMissingIndexError(error)) {
      return {
        query: trimmedQuery,
        stories: [],
        total: 0,
        hasMore: false,
      };
    }

    throw error;
  }
};
