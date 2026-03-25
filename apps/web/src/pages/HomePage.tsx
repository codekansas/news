import type { RuntimeConfig, StorySummary } from '@news/shared';
import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { StoryTable } from '../components/StoryTable';
import { listStories } from '../lib/api';

export const HomePage = ({ config }: { config: RuntimeConfig }) => {
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listStories(config)
      .then((response) => {
        if (!cancelled) {
          setStories(response.stories);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load stories.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config]);

  return (
    <Layout currentPage="home">
      {error ? <div className="app-error">{error}</div> : <StoryTable stories={stories} />}
    </Layout>
  );
};
