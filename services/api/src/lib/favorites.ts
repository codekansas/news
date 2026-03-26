import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { FavoriteRecord, Story, StoryListPage, StorySummary } from '@news/shared';
import { documentClient } from './dynamodb';
import { env } from './env';
import { getStoriesByIds, getStoryById } from './stories';
import { getUserProfileByUsername } from './users';

const defaultPageSize = 30;
const maxPageSize = 30;

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

const toStorySummary = ({
  storyText: _storyText,
  summary: _summary,
  ...story
}: Story): StorySummary => story;

const sortNewestFavoriteFirst = (left: FavoriteRecord, right: FavoriteRecord) => {
  const createdAtDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return right.storyId.localeCompare(left.storyId);
};

const listAllFavoritesForUser = async (userId: string): Promise<FavoriteRecord[]> => {
  const favorites: FavoriteRecord[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(
      new QueryCommand({
        TableName: env.favoritesTableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    favorites.push(...((response.Items as FavoriteRecord[] | undefined) ?? []));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return favorites;
};

export const isStoryFavorited = async (userId: string, storyId: string): Promise<boolean> => {
  const response = await documentClient.send(
    new GetCommand({
      TableName: env.favoritesTableName,
      Key: {
        userId,
        storyId,
      },
    }),
  );

  return Boolean(response.Item);
};

export const favoriteStory = async (userId: string, storyId: string) => {
  const story = await getStoryById(storyId);
  if (!story) {
    throw new Error('Story not found.');
  }

  const favorited = await isStoryFavorited(userId, storyId);
  if (favorited) {
    return;
  }

  await documentClient.send(
    new PutCommand({
      TableName: env.favoritesTableName,
      Item: {
        userId,
        storyId,
        createdAt: new Date().toISOString(),
      } satisfies FavoriteRecord,
      ConditionExpression: 'attribute_not_exists(storyId)',
    }),
  );
};

export const unfavoriteStory = async (userId: string, storyId: string) => {
  await documentClient.send(
    new DeleteCommand({
      TableName: env.favoritesTableName,
      Key: {
        userId,
        storyId,
      },
    }),
  );
};

export const listFavoriteStoriesPage = async ({
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
  const profile = await getUserProfileByUsername(username);

  if (!profile) {
    return {
      stories: [],
      hasMore: false,
    };
  }

  const favoriteRecords = (await listAllFavoritesForUser(profile.userId)).sort(
    sortNewestFavoriteFirst,
  );
  const selectedFavorites = favoriteRecords.slice(offset, offset + safePageSize);
  const storiesById = await getStoriesByIds(selectedFavorites.map((favorite) => favorite.storyId));

  return {
    stories: selectedFavorites
      .map((favorite) => storiesById.get(favorite.storyId))
      .filter((story): story is Story => Boolean(story))
      .map(toStorySummary),
    hasMore: offset + safePageSize < favoriteRecords.length,
  };
};
