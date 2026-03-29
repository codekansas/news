import {
  BatchGetCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  Story,
  StoryFeedMode,
  StoryFeedPage,
  StoryListPage,
  StorySummary,
} from '@news/shared';
import { documentClient } from './dynamodb';
import { env } from './env';

const defaultPageSize = 30;
const maxPageSize = 30;

const clampPageSize = (pageSize: number | undefined) => {
  if (!pageSize || Number.isNaN(pageSize)) {
    return defaultPageSize;
  }

  return Math.max(1, Math.min(maxPageSize, Math.trunc(pageSize)));
};

const clampPageNumber = (page: number | undefined) => {
  if (!page || Number.isNaN(page)) {
    return 1;
  }

  return Math.max(1, Math.trunc(page));
};

const buildPublicationDate = (publishedAt: string) => {
  const parsed = new Date(publishedAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid publishedAt value: ${publishedAt}`);
  }

  return parsed.toISOString().slice(0, 10);
};

const buildPublishedAtMs = (publishedAt: string) => {
  const publishedAtMs = new Date(publishedAt).getTime();
  if (Number.isNaN(publishedAtMs)) {
    throw new Error(`Invalid publishedAt value: ${publishedAt}`);
  }

  return publishedAtMs;
};

const encodeCursor = (value: Record<string, unknown> | undefined) =>
  value ? Buffer.from(JSON.stringify(value)).toString('base64url') : null;

const decodeCursor = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf-8')) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid cursor.');
  }
};

const parseDay = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Invalid day. Expected YYYY-MM-DD.');
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid day. Expected YYYY-MM-DD.');
  }

  return value;
};

const toStorySummary = ({
  storyText: _storyText,
  summary: _summary,
  ...story
}: Story): StorySummary => story;

const sortNewestFirst = (
  left: { id: string; publishedAt: string },
  right: { id: string; publishedAt: string },
) => {
  const publishedAtDelta =
    new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();

  if (publishedAtDelta !== 0) {
    return publishedAtDelta;
  }

  return right.id.localeCompare(left.id);
};

const queryStories = async (
  query: QueryCommand['input'],
  selectedDay: string | null,
): Promise<StoryFeedPage> => {
  const response = await documentClient.send(new QueryCommand(query));

  return {
    stories: (response.Items as StorySummary[] | undefined) ?? [],
    nextCursor: encodeCursor(response.LastEvaluatedKey as Record<string, unknown> | undefined),
    selectedDay,
  };
};

const getLatestStoryDay = async () => {
  const response = await documentClient.send(
    new QueryCommand({
      TableName: env.storiesTableName,
      IndexName: env.frontPageIndexName,
      KeyConditionExpression: '#publicationStatus = :publicationStatus',
      ExpressionAttributeNames: {
        '#publicationStatus': 'publicationStatus',
      },
      ExpressionAttributeValues: {
        ':publicationStatus': 'PUBLISHED',
      },
      ProjectionExpression: 'publishedAt, publicationDate',
      Limit: 1,
      ScanIndexForward: false,
    }),
  );

  const item = response.Items?.[0] as
    | { publicationDate?: string; publishedAt?: string }
    | undefined;
  if (item?.publicationDate) {
    return item.publicationDate;
  }

  if (item?.publishedAt) {
    return buildPublicationDate(item.publishedAt);
  }

  return new Date().toISOString().slice(0, 10);
};

export const listStoriesPage = async ({
  mode = 'front',
  day,
  cursor,
  pageSize,
}: {
  mode?: StoryFeedMode;
  day?: string;
  cursor?: string;
  pageSize?: number;
}): Promise<StoryFeedPage> => {
  const limit = clampPageSize(pageSize);
  const exclusiveStartKey = decodeCursor(cursor);

  if (mode === 'past') {
    const selectedDay = day ? parseDay(day) : await getLatestStoryDay();

    return queryStories(
      {
        TableName: env.storiesTableName,
        IndexName: env.pastDayIndexName,
        KeyConditionExpression: '#publicationDate = :publicationDate',
        ExpressionAttributeNames: {
          '#publicationDate': 'publicationDate',
        },
        ExpressionAttributeValues: {
          ':publicationDate': selectedDay,
        },
        ExclusiveStartKey: exclusiveStartKey,
        Limit: limit,
        ScanIndexForward: false,
      },
      selectedDay,
    );
  }

  return queryStories(
    {
      TableName: env.storiesTableName,
      IndexName: env.frontPageIndexName,
      KeyConditionExpression: '#publicationStatus = :publicationStatus',
      ExpressionAttributeNames: {
        '#publicationStatus': 'publicationStatus',
      },
      ExpressionAttributeValues: {
        ':publicationStatus': 'PUBLISHED',
      },
      ExclusiveStartKey: exclusiveStartKey,
      Limit: limit,
      ScanIndexForward: false,
    },
    null,
  );
};

export const getStoryById = async (storyId: string): Promise<Story | null> => {
  const response = await documentClient.send(
    new GetCommand({
      TableName: env.storiesTableName,
      Key: {
        id: storyId,
      },
    }),
  );

  return (response.Item as Story | undefined) ?? null;
};

export const getStoriesByIds = async (storyIds: string[]): Promise<Map<string, Story>> => {
  if (storyIds.length === 0) {
    return new Map();
  }

  const response = await documentClient.send(
    new BatchGetCommand({
      RequestItems: {
        [env.storiesTableName]: {
          Keys: storyIds.map((storyId) => ({
            id: storyId,
          })),
        },
      },
    }),
  );

  const stories = (response.Responses?.[env.storiesTableName] as Story[] | undefined) ?? [];
  return new Map(stories.map((story) => [story.id, story] as const));
};

export const listAllStories = async (): Promise<Story[]> => {
  const stories: Story[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: env.storiesTableName,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    stories.push(...((response.Items as Story[] | undefined) ?? []));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return stories;
};

export const listStoriesBySubmitterPage = async ({
  username,
  page,
  pageSize,
}: {
  username: string;
  page?: number;
  pageSize?: number;
}): Promise<StoryListPage> => {
  const safePage = clampPageNumber(page);
  const safePageSize = clampPageSize(pageSize);
  const offset = (safePage - 1) * safePageSize;

  const matchingStories = (await listAllStories())
    .filter((story) => story.submittedBy === username)
    .sort(sortNewestFirst);

  return {
    stories: matchingStories.slice(offset, offset + safePageSize).map(toStorySummary),
    hasMore: offset + safePageSize < matchingStories.length,
  };
};

export const upsertStory = async (story: Story) => {
  const publicationDate = buildPublicationDate(story.publishedAt);
  const publishedAtMs = buildPublishedAtMs(story.publishedAt);

  await documentClient.send(
    new UpdateCommand({
      TableName: env.storiesTableName,
      Key: {
        id: story.id,
      },
      UpdateExpression: `
        SET #title = :title,
            #url = :url,
            #siteLabel = :siteLabel,
            #siteUrl = :siteUrl,
            #sourceKey = :sourceKey,
            #sourceTitle = :sourceTitle,
            #sourceCategory = :sourceCategory,
            #submittedBy = :submittedBy,
            #publishedAt = :publishedAt,
            #storyText = :storyText,
            #summary = :summary,
            #rankingScore = :rankingScore,
            #publicationDate = :publicationDate,
            #publishedAtMs = :publishedAtMs,
            #publicationStatus = :publicationStatus,
            #commentCount = if_not_exists(#commentCount, :zero)
        REMOVE #points
      `,
      ExpressionAttributeNames: {
        '#commentCount': 'commentCount',
        '#points': 'points',
        '#publicationDate': 'publicationDate',
        '#publicationStatus': 'publicationStatus',
        '#publishedAt': 'publishedAt',
        '#publishedAtMs': 'publishedAtMs',
        '#rankingScore': 'rankingScore',
        '#siteLabel': 'siteLabel',
        '#siteUrl': 'siteUrl',
        '#sourceCategory': 'sourceCategory',
        '#sourceKey': 'sourceKey',
        '#sourceTitle': 'sourceTitle',
        '#storyText': 'storyText',
        '#submittedBy': 'submittedBy',
        '#summary': 'summary',
        '#title': 'title',
        '#url': 'url',
      },
      ExpressionAttributeValues: {
        ':title': story.title,
        ':url': story.url,
        ':siteLabel': story.siteLabel,
        ':siteUrl': story.siteUrl,
        ':sourceKey': story.sourceKey,
        ':sourceTitle': story.sourceTitle,
        ':sourceCategory': story.sourceCategory,
        ':submittedBy': story.submittedBy,
        ':publishedAt': story.publishedAt,
        ':publishedAtMs': publishedAtMs,
        ':publicationDate': publicationDate,
        ':storyText': story.storyText,
        ':summary': story.summary,
        ':rankingScore': story.rankingScore,
        ':publicationStatus': 'PUBLISHED',
        ':zero': 0,
      },
    }),
  );
};
