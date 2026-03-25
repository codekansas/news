import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { CommentRecord, CommentTreeNode } from '@news/shared';
import { buildCommentTree } from '@news/shared';
import { ulid } from 'ulid';
import { documentClient } from './dynamodb';
import { env } from './env';

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

  return comment;
};
