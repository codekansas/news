import type { RecentCommentSummary, RuntimeConfig } from '@news/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { listUserComments } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatAge, renderCommentText } from '../lib/format';

const parsePageNumber = (search: string) => {
  const value = new URLSearchParams(search).get('page');
  const page = value ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const parseUsername = (search: string) => new URLSearchParams(search).get('id')?.trim() ?? '';

const buildCommentLink = (storyId: string, commentId: string) => `/item/${storyId}#${commentId}`;

const buildParentLink = (comment: RecentCommentSummary) =>
  comment.parentId ? `/item/${comment.storyId}#${comment.parentId}` : `/item/${comment.storyId}`;

const buildMoreLink = (username: string, page: number) => {
  const params = new URLSearchParams({
    id: username,
  });

  if (page > 1) {
    params.set('page', String(page));
  }

  return `/threads?${params.toString()}`;
};

export const ThreadsPage = ({ config }: { config: RuntimeConfig }) => {
  const location = useLocation();
  const { profile, status } = useAuth();
  const page = useMemo(() => parsePageNumber(location.search), [location.search]);
  const username = useMemo(() => parseUsername(location.search), [location.search]);
  const [comments, setComments] = useState<RecentCommentSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!username) {
      setComments([]);
      setHasMore(false);
      setLoading(false);
      setError('Missing user id.');
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    listUserComments(config, username, { page })
      .then((response) => {
        if (!cancelled) {
          setComments(response.comments);
          setHasMore(response.hasMore);
          setLoading(false);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load comments.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config, page, username]);

  const currentPage =
    status === 'authenticated' && profile?.username === username ? 'threads' : 'user';

  return (
    <Layout currentPage={currentPage}>
      <div className="activity-page-intro">Comments by {username || 'user'}</div>
      {error ? (
        <div className="app-error">{error}</div>
      ) : loading ? (
        <LoadingIndicator label="Loading comments..." />
      ) : comments.length > 0 ? (
        <div className="comments-page">
          {comments.map((comment) => (
            <div className="comments-page-entry" key={comment.commentId}>
              <span className="comhead">
                <span className="hnuser">{comment.authorName}</span>{' '}
                <span className="age" title={comment.createdAt}>
                  <Link to={buildCommentLink(comment.storyId, comment.commentId)}>
                    {formatAge(comment.createdAt)}
                  </Link>
                </span>{' '}
                | <Link to={buildParentLink(comment)}>parent</Link> |{' '}
                <Link to={buildCommentLink(comment.storyId, comment.commentId)}>context</Link> | on:{' '}
                <Link className="comments-page-story-link" to={`/item/${comment.storyId}`}>
                  {comment.storyTitle}
                </Link>
              </span>
              <div className="comment comments-page-text">
                <div className="commtext c00">{renderCommentText(comment.text)}</div>
              </div>
            </div>
          ))}
          {hasMore ? (
            <div className="comments-page-more">
              <Link to={buildMoreLink(username, page + 1)}>More</Link>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="activity-page-empty">No comments.</div>
      )}
    </Layout>
  );
};
