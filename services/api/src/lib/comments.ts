import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  CommentRecord,
  CommentTreeNode,
  RecentCommentSummary,
  RecentCommentsPage,
} from '@news/shared';
import { buildCommentTree } from '@news/shared';
import { ulid } from 'ulid';
import { documentClient } from './dynamodb';
import { env } from './env';
import { createReplyNotification } from './notifications';
import { getStoryById } from './stories';
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

const buildPathSegment = (createdAt: string, commentId: string) => {
  const millis = new Date(createdAt).getTime().toString().padStart(13, '0');
  return `${millis}_${commentId}`;
};

export const listCommentsForStory = async (storyId: string): Promise<CommentTreeNode[]> => {
  const response = await documentClient.send(
    new QueryCommand({
      TableName: env.commentsTableName,
      KeyConditionExpression: 'storyId = :storyId',
      ExpressionAttributeValues: {
        ':storyId': storyId,
      },
      ScanIndexForward: true,
    }),
  );

  return buildCommentTree((response.Items as CommentRecord[] | undefined) ?? []);
};

const listAllComments = async (): Promise<CommentRecord[]> => {
  const comments: CommentRecord[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: env.commentsTableName,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    comments.push(...((response.Items as CommentRecord[] | undefined) ?? []));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return comments;
};

const sortRecentFirst = (left: CommentRecord, right: CommentRecord) => {
  const createdAtDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return right.commentId.localeCompare(left.commentId);
};

export const listRecentCommentsPage = async ({
  page,
  pageSize,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<RecentCommentsPage> => {
  const safePage = clampPageNumber(page);
  const safePageSize = clampPageSize(pageSize);
  const offset = (safePage - 1) * safePageSize;

  const allComments = await listAllComments();
  const recentComments = allComments.sort(sortRecentFirst).slice(offset, offset + safePageSize);

  const storyIds = [...new Set(recentComments.map((comment) => comment.storyId))];
  const stories = await Promise.all(storyIds.map((storyId) => getStoryById(storyId)));
  const storiesById = new Map(
    stories.flatMap((story) => (story ? [[story.id, story] as const] : [])),
  );

  const comments: RecentCommentSummary[] = recentComments.map((comment) => ({
    authorName: comment.authorName,
    commentId: comment.commentId,
    createdAt: comment.createdAt,
    parentId: comment.parentId,
    storyId: comment.storyId,
    storyTitle: storiesById.get(comment.storyId)?.title ?? '[deleted]',
    text: comment.text,
  }));

  return {
    comments,
    hasMore: offset + safePageSize < allComments.length,
  };
};

export const listCommentsByAuthorPage = async ({
  username,
  page,
  pageSize,
}: {
  username: string;
  page?: number;
  pageSize?: number;
}): Promise<RecentCommentsPage> => {
  const safePage = clampPageNumber(page);
  const safePageSize = clampPageSize(pageSize);
  const offset = (safePage - 1) * safePageSize;
  const profile = await getUserProfileByUsername(username);

  const matchingComments = (await listAllComments())
    .filter((comment) =>
      profile
        ? comment.authorId === profile.userId || comment.authorName === username
        : comment.authorName === username,
    )
    .sort(sortRecentFirst);

  const selectedComments = matchingComments.slice(offset, offset + safePageSize);
  const storyIds = [...new Set(selectedComments.map((comment) => comment.storyId))];
  const stories = await Promise.all(storyIds.map((storyId) => getStoryById(storyId)));
  const storiesById = new Map(
    stories.flatMap((story) => (story ? [[story.id, story] as const] : [])),
  );

  return {
    comments: selectedComments.map((comment) => ({
      authorName: profile?.username ?? comment.authorName,
      commentId: comment.commentId,
      createdAt: comment.createdAt,
      parentId: comment.parentId,
      storyId: comment.storyId,
      storyTitle: storiesById.get(comment.storyId)?.title ?? '[deleted]',
      text: comment.text,
    })),
    hasMore: offset + safePageSize < matchingComments.length,
  };
};

export const createComment = async ({
  storyId,
  parentId,
  text,
  authorId,
  authorName,
}: {
  storyId: string;
  parentId: string | null;
  text: string;
  authorId: string;
  authorName: string;
}) => {
  const trimmedText = text.trim();
  if (trimmedText.length < 2) {
    throw new Error('Comments must be at least 2 characters long.');
  }

  if (trimmedText.length > 4_000) {
    throw new Error('Comments are limited to 4000 characters.');
  }

  let parent: CommentRecord | null = null;
  if (parentId) {
    const response = await documentClient.send(
      new GetCommand({
        TableName: env.commentsTableName,
        Key: {
          storyId,
          commentId: parentId,
        },
      }),
    );

    parent = (response.Item as CommentRecord | undefined) ?? null;

    if (!parent) {
      throw new Error('The comment you are replying to no longer exists.');
    }
  }

  const commentId = ulid();
  const createdAt = new Date().toISOString();
  const pathSegment = buildPathSegment(createdAt, commentId);
  const comment: CommentRecord = {
    storyId,
    commentId,
    parentId,
    path: parent ? `${parent.path}/${pathSegment}` : pathSegment,
    depth: parent ? parent.depth + 1 : 0,
    authorId,
    authorName,
    text: trimmedText,
    createdAt,
  };

  await documentClient.send(
    new PutCommand({
      TableName: env.commentsTableName,
      Item: comment,
      ConditionExpression: 'attribute_not_exists(commentId)',
    }),
  );

  await documentClient.send(
    new UpdateCommand({
      TableName: env.storiesTableName,
      Key: {
        id: storyId,
      },
      UpdateExpression: 'SET commentCount = if_not_exists(commentCount, :zero) + :increment',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':increment': 1,
      },
      ConditionExpression: 'attribute_exists(id)',
    }),
  );

  if (parent && parent.authorId !== authorId) {
    try {
      const story = await getStoryById(storyId);
      await createReplyNotification({
        actorUserId: authorId,
        actorUsername: authorName,
        excerpt: trimmedText,
        parentCommentId: parent.commentId,
        replyCommentId: comment.commentId,
        storyId,
        storyTitle: story?.title ?? '[deleted]',
        userId: parent.authorId,
      });
    } catch (error) {
      console.error('Unable to create reply notification.', error);
    }
  }

  return comment;
};
