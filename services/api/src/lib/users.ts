import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { UserProfile } from '@news/shared';
import { hashString, pickRandomSubmitter } from '@news/shared';
import { documentClient } from './dynamodb';
import { env } from './env';

const buildUsername = (userId: string, email: string): string => {
  const base = pickRandomSubmitter(`${userId}:${email}`).slice(0, 18);
  const suffix = hashString(userId).toString(36).slice(0, 3);
  return `${base}${suffix}`;
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const response = await documentClient.send(
    new GetCommand({
      TableName: env.usersTableName,
      Key: {
        userId,
      },
    }),
  );

  return (response.Item as UserProfile | undefined) ?? null;
};

export const ensureUserProfile = async (userId: string, email: string): Promise<UserProfile> => {
  const existing = await getUserProfile(userId);
  if (existing) {
    return existing;
  }

  const profile: UserProfile = {
    userId,
    email,
    username: buildUsername(userId, email),
    createdAt: new Date().toISOString(),
  };

  await documentClient.send(
    new PutCommand({
      TableName: env.usersTableName,
      Item: profile,
      ConditionExpression: 'attribute_not_exists(userId)',
    }),
  );

  return profile;
};
