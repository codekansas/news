import type { RuntimeConfig, StorySummary } from '@news/shared';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StoryTable } from '../components/StoryTable';
import { listUserFavorites } from '../lib/api';

const parsePageNumber = (search: string) => {
  const value = new URLSearchParams(search).get('page');
  const page = value ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const parseUsername = (search: string) => new URLSearchParams(search).get('id')?.trim() ?? '';

const buildMoreLink = (username: string, page: number) => {
  const params = new URLSearchParams({
    id: username,
  });

  if (page > 1) {
    params.set('page', String(page));
  }

  return `/favorites?${params.toString()}`;
};

export const FavoritesPage = ({ config }: { config: RuntimeConfig }) => {
  const location = useLocation();
  const page = useMemo(() => parsePageNumber(location.search), [location.search]);
  const username = useMemo(() => parseUsername(location.search), [location.search]);
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!username) {
      setStories([]);
      setHasMore(false);
      setLoading(false);
      setError('Missing user id.');
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    listUserFavorites(config, username, { page })
      .then((response) => {
        if (!cancelled) {
          setStories(response.stories);
          setHasMore(response.hasMore);
          setLoading(false);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load favorites.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config, page, username]);

  return (
    <Layout currentPage="favorites">
      <div className="activity-page-intro">Favorite articles by {username || 'user'}</div>
      {error ? (
        <div className="app-error">{error}</div>
      ) : loading ? (
        <LoadingIndicator label="Loading favorites..." />
      ) : stories.length > 0 ? (
        <StoryTable
          moreLink={hasMore ? buildMoreLink(username, page + 1) : null}
          showSourceTitle={false}
          startRank={(page - 1) * 30 + 1}
          stories={stories}
        />
      ) : (
        <div className="activity-page-empty">No favorite articles.</div>
      )}
    </Layout>
  );
};
