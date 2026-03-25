import { refreshStoriesFromRss } from '../lib/rss';

export const handler = async () => {
  const storyCount = await refreshStoriesFromRss();
  return { storyCount };
};
