type Environment = {
  storiesTableName: string;
  commentsTableName: string;
  usersTableName: string;
  frontPageIndexName: string;
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
  usersTableName: getValue('USERS_TABLE_NAME'),
  frontPageIndexName: getValue('FRONT_PAGE_INDEX_NAME'),
};
