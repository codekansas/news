import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { UpdateUserProfileInput, UserPreferenceSetting, UserProfile } from '@news/shared';
import { hashString, pickRandomSubmitter } from '@news/shared';
import { documentClient } from './dynamodb';
import { env } from './env';

type StoredUserProfile = Partial<UserProfile> &
  Pick<UserProfile, 'userId' | 'username' | 'createdAt'> & {
    email?: string;
  };

const buildUsername = (userId: string, email: string): string => {
  const base = pickRandomSubmitter(`${userId}:${email}`).slice(0, 18);
  const suffix = hashString(userId).toString(36).slice(0, 3);
  return `${base}${suffix}`;
};

const buildDefaultKarma = (userId: string) => (hashString(`${userId}:karma`) % 900) + 100;

const normalizeSingleLine = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';

const normalizeMultiline = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, maxLength) : '';

const normalizeToggle = (value: unknown): UserPreferenceSetting => (value === 'yes' ? 'yes' : 'no');

const normalizeInteger = (value: unknown, fallback: number, minimum: number, maximum: number) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)));
};

const normalizeTopColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.replace(/^#/, '').trim().toLowerCase();
  return /^[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
};

const normalizeUsername = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Username is required.');
  }

  if (!/^[a-z0-9_-]{2,24}$/.test(normalized)) {
    throw new Error(
      'Usernames must be 2-24 characters using lowercase letters, numbers, "_" or "-".',
    );
  }

  return normalized;
};

const normalizeUserProfile = (profile: StoredUserProfile, fallbackEmail: string): UserProfile => ({
  userId: profile.userId,
  username: profile.username,
  email: normalizeSingleLine(profile.email, 254) || fallbackEmail,
  createdAt: profile.createdAt,
  name: normalizeSingleLine(profile.name, 120),
  bio: normalizeSingleLine(profile.bio, 120),
  about: normalizeMultiline(profile.about, 5000),
  showdead: normalizeToggle(profile.showdead),
  noprocrast: normalizeToggle(profile.noprocrast),
  maxvisit: normalizeInteger(profile.maxvisit, 20, 1, 120),
  minaway: normalizeInteger(profile.minaway, 180, 1, 1440),
  topcolor: normalizeTopColor(profile.topcolor, 'ff6600'),
  delay: normalizeInteger(profile.delay, 0, 0, 60),
  karma: normalizeInteger(profile.karma, buildDefaultKarma(profile.userId), 1, 9999),
});

const buildDefaultUserProfile = (userId: string, email: string): UserProfile => ({
  userId,
  email,
  username: buildUsername(userId, email),
  createdAt: new Date().toISOString(),
  name: '',
  bio: '',
  about: '',
  showdead: 'no',
  noprocrast: 'no',
  maxvisit: 20,
  minaway: 180,
  topcolor: 'ff6600',
  delay: 0,
  karma: buildDefaultKarma(userId),
});

const listAllStoredUserProfiles = async (): Promise<StoredUserProfile[]> => {
  const profiles: StoredUserProfile[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: env.usersTableName,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    profiles.push(...((response.Items as StoredUserProfile[] | undefined) ?? []));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return profiles;
};

const getStoredUserProfileByUsername = async (
  username: string,
): Promise<StoredUserProfile | null> => {
  const profiles = await listAllStoredUserProfiles();
  return profiles.find((profile) => profile.username === username) ?? null;
};

const assertUsernameAvailable = async (userId: string, username: string) => {
  const existing = await getStoredUserProfileByUsername(username);
  if (existing && existing.userId !== userId) {
    throw new Error('That username is already taken.');
  }
};

const syncCommentAuthorNames = async (userId: string, username: string) => {
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: env.commentsTableName,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    const comments =
      (response.Items as
        | Array<{ authorId: string; authorName: string; commentId: string; storyId: string }>
        | undefined) ?? [];

    const updates = comments
      .filter((comment) => comment.authorId === userId && comment.authorName !== username)
      .map((comment) =>
        documentClient.send(
          new UpdateCommand({
            TableName: env.commentsTableName,
            Key: {
              storyId: comment.storyId,
              commentId: comment.commentId,
            },
            UpdateExpression: 'SET authorName = :authorName',
            ExpressionAttributeValues: {
              ':authorName': username,
            },
          }),
        ),
      );

    await Promise.all(updates);
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);
};

export const getUserProfile = async (
  userId: string,
  fallbackEmail = '',
): Promise<UserProfile | null> => {
  const response = await documentClient.send(
    new GetCommand({
      TableName: env.usersTableName,
      Key: {
        userId,
      },
    }),
  );

  const item = response.Item as StoredUserProfile | undefined;
  return item ? normalizeUserProfile(item, fallbackEmail) : null;
};

export const ensureUserProfile = async (userId: string, email: string): Promise<UserProfile> => {
  const existing = await getUserProfile(userId, email);
  if (existing) {
    return existing;
  }

  const profile = buildDefaultUserProfile(userId, email);

  await documentClient.send(
    new PutCommand({
      TableName: env.usersTableName,
      Item: profile,
      ConditionExpression: 'attribute_not_exists(userId)',
    }),
  );

  return profile;
};

export const getUserProfileByUsername = async (username: string): Promise<UserProfile | null> => {
  const storedProfile = await getStoredUserProfileByUsername(username);
  if (!storedProfile) {
    return null;
  }

  return normalizeUserProfile(storedProfile, normalizeSingleLine(storedProfile.email, 254));
};

export const updateUserProfile = async (
  currentProfile: UserProfile,
  input: UpdateUserProfileInput,
): Promise<UserProfile> => {
  const username = normalizeUsername(input.username, currentProfile.username);
  if (username !== currentProfile.username) {
    await assertUsernameAvailable(currentProfile.userId, username);
  }

  const profile = normalizeUserProfile(
    {
      ...currentProfile,
      username,
      email: normalizeSingleLine(input.email, 254) || currentProfile.email,
      name: input.name,
      about: input.about,
      showdead: input.showdead,
      noprocrast: input.noprocrast,
      maxvisit: input.maxvisit,
      minaway: input.minaway,
      topcolor: input.topcolor,
      delay: input.delay,
    },
    currentProfile.email,
  );

  await documentClient.send(
    new PutCommand({
      TableName: env.usersTableName,
      Item: profile,
    }),
  );

  if (profile.username !== currentProfile.username) {
    try {
      await syncCommentAuthorNames(profile.userId, profile.username);
    } catch (error) {
      console.error('Unable to synchronize renamed comment authors.', error);
    }
  }

  return profile;
};
