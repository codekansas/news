import type { RuntimeConfig, StorySummary } from '@news/shared';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StoryTable } from '../components/StoryTable';
import { listStories } from '../lib/api';

const parsePageNumber = (search: string) => {
  const value = new URLSearchParams(search).get('page');
  const page = value ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const parseCursor = (search: string) => new URLSearchParams(search).get('cursor') ?? undefined;

export const HomePage = ({ config }: { config: RuntimeConfig }) => {
  const location = useLocation();
  const page = useMemo(() => parsePageNumber(location.search), [location.search]);
  const cursor = useMemo(() => parseCursor(location.search), [location.search]);
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setNextCursor(null);

    listStories(config, { cursor })
      .then((response) => {
        if (!cancelled) {
          setStories(response.stories);
          setNextCursor(response.nextCursor);
          setLoading(false);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load stories.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config, cursor]);

  const moreLink = useMemo(() => {
    if (!nextCursor) {
      return null;
    }

    const params = new URLSearchParams();
    params.set('page', String(page + 1));
    params.set('cursor', nextCursor);
    return `/?${params.toString()}`;
  }, [nextCursor, page]);

  return (
    <Layout currentPage="home">
      {error ? (
        <div className="app-error">{error}</div>
      ) : loading ? (
        <LoadingIndicator label="Loading stories..." />
      ) : (
        <StoryTable moreLink={moreLink} startRank={(page - 1) * 30 + 1} stories={stories} />
      )}
    </Layout>
  );
};
