import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type {
  MailboxNotification,
  NotificationRecord,
  NotificationsPage,
  PushSubscriptionInput,
} from '@news/shared';
import { ulid } from 'ulid';
import webpush from 'web-push';
import { documentClient } from './dynamodb';
import { env } from './env';

type PushSubscriptionRecord = PushSubscriptionInput & {
  userId: string;
  createdAt: string;
  updatedAt: string;
};

type VapidSecret = {
  publicKey: string;
  privateKey: string;
};

const secretsClient = new SecretsManagerClient({});
const recentNotificationsLimit = 40;
let vapidSecretPromise: Promise<VapidSecret> | null = null;

const toNotificationUrl = (notification: Pick<NotificationRecord, 'replyCommentId' | 'storyId'>) =>
  `/item/${notification.storyId}#${notification.replyCommentId}`;

const toMailboxNotification = (notification: NotificationRecord): MailboxNotification => ({
  ...notification,
  readAt: notification.readAt ?? null,
  url: toNotificationUrl(notification),
});

const normalizeExcerpt = (value: string) => {
  const flattened = value.replace(/\s+/g, ' ').trim();
  if (flattened.length <= 160) {
    return flattened;
  }

  return `${flattened.slice(0, 157).trimEnd()}...`;
};

const listPushSubscriptionsForUser = async (userId: string) => {
  const response = await documentClient.send(
    new QueryCommand({
      TableName: env.pushSubscriptionsTableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    }),
  );

  return (response.Items as PushSubscriptionRecord[] | undefined) ?? [];
};

const listPushSubscriptionsByEndpoint = async (endpoint: string) => {
  const response = await documentClient.send(
    new QueryCommand({
      TableName: env.pushSubscriptionsTableName,
      IndexName: env.pushSubscriptionsEndpointIndexName,
      KeyConditionExpression: 'endpoint = :endpoint',
      ExpressionAttributeValues: {
        ':endpoint': endpoint,
      },
    }),
  );

  return (response.Items as PushSubscriptionRecord[] | undefined) ?? [];
};

const loadVapidSecret = async () => {
  const response = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: env.vapidSecretArn,
    }),
  );

  if (!response.SecretString) {
    throw new Error('VAPID secret is empty.');
  }

  const parsed = JSON.parse(response.SecretString) as Partial<VapidSecret>;
  if (!parsed.publicKey || !parsed.privateKey) {
    throw new Error('VAPID secret is missing required keys.');
  }

  webpush.setVapidDetails('mailto:ben@bolte.cc', parsed.publicKey, parsed.privateKey);

  return {
    publicKey: parsed.publicKey,
    privateKey: parsed.privateKey,
  };
};

const getVapidSecret = () => {
  if (!vapidSecretPromise) {
    vapidSecretPromise = loadVapidSecret();
  }

  return vapidSecretPromise;
};

const countUnreadNotifications = async (userId: string) => {
  let unreadCount = 0;
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(
      new QueryCommand({
        TableName: env.notificationsTableName,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'isRead = :isRead',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':isRead': false,
        },
        ExclusiveStartKey: exclusiveStartKey,
        Select: 'COUNT',
      }),
    );

    unreadCount += response.Count ?? 0;
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return unreadCount;
};

const listUnreadNotificationIds = async (userId: string) => {
  const notificationIds: string[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(
      new QueryCommand({
        TableName: env.notificationsTableName,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'isRead = :isRead',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':isRead': false,
        },
        ExclusiveStartKey: exclusiveStartKey,
        ProjectionExpression: 'notificationId',
      }),
    );

    const items = (response.Items as Array<{ notificationId: string }> | undefined) ?? [];
    notificationIds.push(...items.map((item) => item.notificationId));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return notificationIds;
};

const sendPushNotifications = async (userId: string, notification: NotificationRecord) => {
  const subscriptions = await listPushSubscriptionsForUser(userId);
  if (subscriptions.length === 0) {
    return;
  }

  await getVapidSecret();

  const payload = JSON.stringify({
    body: `${notification.actorUsername} replied: ${notification.excerpt}`,
    tag: `reply-${notification.parentCommentId}`,
    title: `New reply on ${notification.storyTitle}`,
    url: toNotificationUrl(notification),
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (error) {
        const statusCode =
          typeof error === 'object' &&
          error !== null &&
          'statusCode' in error &&
          typeof error.statusCode === 'number'
            ? error.statusCode
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await deletePushSubscription(userId, subscription.endpoint);
          return;
        }

        console.error('Unable to send push notification.', error);
      }
    }),
  );
};

export const listNotificationsForUser = async (userId: string): Promise<NotificationsPage> => {
  const [notificationsResponse, unreadCount] = await Promise.all([
    documentClient.send(
      new QueryCommand({
        TableName: env.notificationsTableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        Limit: recentNotificationsLimit,
        ScanIndexForward: false,
      }),
    ),
    countUnreadNotifications(userId),
  ]);

  const notifications = (
    (notificationsResponse.Items as NotificationRecord[] | undefined) ?? []
  ).map(toMailboxNotification);

  return {
    notifications,
    unreadCount,
  };
};

export const markAllNotificationsRead = async (userId: string) => {
  const unreadNotificationIds = await listUnreadNotificationIds(userId);
  if (unreadNotificationIds.length === 0) {
    return;
  }

  const readAt = new Date().toISOString();
  await Promise.all(
    unreadNotificationIds.map((notificationId) =>
      documentClient.send(
        new UpdateCommand({
          TableName: env.notificationsTableName,
          Key: {
            userId,
            notificationId,
          },
          UpdateExpression: 'SET isRead = :isRead, readAt = :readAt',
          ExpressionAttributeValues: {
            ':isRead': true,
            ':readAt': readAt,
          },
        }),
      ),
    ),
  );
};

export const savePushSubscription = async (userId: string, subscription: PushSubscriptionInput) => {
  const now = new Date().toISOString();
  const existingSubscriptions = await listPushSubscriptionsByEndpoint(subscription.endpoint);
  const currentSubscription = existingSubscriptions.find((item) => item.userId === userId);

  await Promise.all(
    existingSubscriptions
      .filter((item) => item.userId !== userId)
      .map((item) => deletePushSubscription(item.userId, item.endpoint)),
  );

  await documentClient.send(
    new PutCommand({
      TableName: env.pushSubscriptionsTableName,
      Item: {
        ...subscription,
        userId,
        createdAt: currentSubscription?.createdAt ?? now,
        updatedAt: now,
      } satisfies PushSubscriptionRecord,
    }),
  );
};

export const deletePushSubscription = async (userId: string, endpoint: string) => {
  await documentClient.send(
    new DeleteCommand({
      TableName: env.pushSubscriptionsTableName,
      Key: {
        userId,
        endpoint,
      },
    }),
  );
};

export const createReplyNotification = async ({
  actorUserId,
  actorUsername,
  excerpt,
  parentCommentId,
  replyCommentId,
  storyId,
  storyTitle,
  userId,
}: {
  actorUserId: string;
  actorUsername: string;
  excerpt: string;
  parentCommentId: string;
  replyCommentId: string;
  storyId: string;
  storyTitle: string;
  userId: string;
}) => {
  const notification: NotificationRecord = {
    actorUserId,
    actorUsername,
    createdAt: new Date().toISOString(),
    excerpt: normalizeExcerpt(excerpt),
    isRead: false,
    notificationId: ulid(),
    parentCommentId,
    readAt: null,
    replyCommentId,
    storyId,
    storyTitle,
    type: 'comment_reply',
    userId,
  };

  await documentClient.send(
    new PutCommand({
      TableName: env.notificationsTableName,
      Item: notification,
      ConditionExpression: 'attribute_not_exists(notificationId)',
    }),
  );

  await sendPushNotifications(userId, notification);

  return notification;
};
