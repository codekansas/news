import { refreshStoriesFromRss } from '../lib/rss';

export const handler = async () => {
  return refreshStoriesFromRss();
};
