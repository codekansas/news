import { getStackOutputs } from './stack-outputs';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const main = async () => {
  const outputs = await getStackOutputs();
  const siteUrl = outputs.SiteUrl;

  if (!siteUrl) {
    throw new Error('SiteUrl output is missing.');
  }

  const [homeResponse, configResponse, healthResponse, feedResponse, searchResponse] =
    await Promise.all([
      fetch(siteUrl),
      fetch(`${siteUrl}/runtime-config.json`, {
        cache: 'no-store',
      }),
      fetch(`${siteUrl}/api/health`, {
        cache: 'no-store',
      }),
      fetch(`${siteUrl}/api/feed`, {
        cache: 'no-store',
      }),
      fetch(`${siteUrl}/api/search?q=ai`, {
        cache: 'no-store',
      }),
    ]);

  assert(homeResponse.ok, `Home page failed with ${homeResponse.status}.`);
  assert(configResponse.ok, `runtime-config failed with ${configResponse.status}.`);
  assert(healthResponse.ok, `Health endpoint failed with ${healthResponse.status}.`);
  assert(feedResponse.ok, `Feed endpoint failed with ${feedResponse.status}.`);
  assert(searchResponse.ok, `Search endpoint failed with ${searchResponse.status}.`);

  const homeHtml = await homeResponse.text();
  const feed = (await feedResponse.json()) as {
    stories: Array<{ id: string; title: string }>;
  };
  const search = (await searchResponse.json()) as {
    stories: Array<{ id: string; title: string }>;
  };

  assert(homeHtml.includes('AI News'), 'Home page did not render the AI News shell.');
  assert(feed.stories.length > 0, 'Feed endpoint returned no stories.');
  assert(Array.isArray(search.stories), 'Search endpoint did not return a stories array.');

  console.log(
    JSON.stringify(
      {
        siteUrl,
        storyCount: feed.stories.length,
        firstStory: feed.stories[0]?.title ?? null,
        searchResultCount: search.stories.length,
      },
      null,
      2,
    ),
  );
};

void main();
