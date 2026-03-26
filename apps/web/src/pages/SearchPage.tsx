import type { RuntimeConfig, StorySummary } from '@news/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StoryTable } from '../components/StoryTable';
import { searchStories } from '../lib/api';

const parsePageNumber = (search: string) => {
  const value = new URLSearchParams(search).get('page');
  const page = value ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const parseQuery = (search: string) => new URLSearchParams(search).get('q')?.trim() ?? '';

const buildSearchLink = (query: string, page: number) => {
  const params = new URLSearchParams({
    q: query,
  });

  if (page > 1) {
    params.set('page', String(page));
  }

  return `/search?${params.toString()}`;
};

export const SearchPage = ({ config }: { config: RuntimeConfig }) => {
  const location = useLocation();
  const page = useMemo(() => parsePageNumber(location.search), [location.search]);
  const query = useMemo(() => parseQuery(location.search), [location.search]);
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!query) {
      setStories([]);
      setTotal(0);
      setHasMore(false);
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    searchStories(config, { page, query })
      .then((response) => {
        if (!cancelled) {
          setStories(response.stories);
          setTotal(response.total);
          setHasMore(response.hasMore);
          setLoading(false);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to search stories.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config, page, query]);

  const moreLink = hasMore ? buildSearchLink(query, page + 1) : null;

  return (
    <Layout currentPage="search">
      <div className="search-page-intro">
        {query ? (
          <>
            Search results for <span className="search-page-query">"{query}"</span>
            <div className="search-page-meta">{total} matching stories</div>
          </>
        ) : (
          <>Enter a search above or in the footer box below.</>
        )}
      </div>
      {error ? (
        <div className="app-error">{error}</div>
      ) : loading ? (
        <LoadingIndicator label="Searching stories..." />
      ) : query ? (
        stories.length > 0 ? (
          <StoryTable moreLink={moreLink} startRank={(page - 1) * 30 + 1} stories={stories} />
        ) : (
          <div className="search-page-empty">
            No stories matched <span className="search-page-query">"{query}"</span>.
          </div>
        )
      ) : (
        <div className="search-page-empty">
          Try a title, site name, summary phrase, or feed source.
        </div>
      )}
      {query && total > 0 && !hasMore ? (
        <div className="search-page-footer">
          <Link to={buildSearchLink(query, 1)}>Back to first page</Link>
        </div>
      ) : null}
    </Layout>
  );
};
