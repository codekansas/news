type Environment = {
  storiesTableName: string;
  commentsTableName: string;
  favoritesTableName: string;
  notificationsTableName: string;
  pushSubscriptionsTableName: string;
  usersTableName: string;
  frontPageIndexName: string;
  pastDayIndexName: string;
  searchCollectionEndpoint: string;
  searchIndexName: string;
  pushSubscriptionsEndpointIndexName: string;
  vapidSecretArn: string;
};

const getValue = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
};

export const env: Environment = {
  storiesTableName: getValue('STORIES_TABLE_NAME'),
  commentsTableName: getValue('COMMENTS_TABLE_NAME'),
  favoritesTableName: getValue('FAVORITES_TABLE_NAME'),
  notificationsTableName: getValue('NOTIFICATIONS_TABLE_NAME'),
  pushSubscriptionsTableName: getValue('PUSH_SUBSCRIPTIONS_TABLE_NAME'),
  usersTableName: getValue('USERS_TABLE_NAME'),
  frontPageIndexName: getValue('FRONT_PAGE_INDEX_NAME'),
  pastDayIndexName: getValue('PAST_DAY_INDEX_NAME'),
  searchCollectionEndpoint: getValue('SEARCH_COLLECTION_ENDPOINT'),
  searchIndexName: getValue('SEARCH_INDEX_NAME'),
  pushSubscriptionsEndpointIndexName: getValue('PUSH_SUBSCRIPTIONS_ENDPOINT_INDEX_NAME'),
  vapidSecretArn: getValue('VAPID_SECRET_ARN'),
};
