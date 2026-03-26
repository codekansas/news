import type { RecentCommentSummary, RuntimeConfig } from '@news/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { listRecentComments } from '../lib/api';
import { formatAge, renderCommentText } from '../lib/format';

const parsePageNumber = (search: string) => {
  const value = new URLSearchParams(search).get('page');
  const page = value ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const buildCommentLink = (storyId: string, commentId: string) => `/item/${storyId}#${commentId}`;

const buildParentLink = (comment: RecentCommentSummary) =>
  comment.parentId ? `/item/${comment.storyId}#${comment.parentId}` : `/item/${comment.storyId}`;

export const CommentsPage = ({ config }: { config: RuntimeConfig }) => {
  const location = useLocation();
  const page = useMemo(() => parsePageNumber(location.search), [location.search]);
  const [comments, setComments] = useState<RecentCommentSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    listRecentComments(config, { page })
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
  }, [config, page]);

  const moreLink = hasMore ? `/comments?page=${page + 1}` : null;

  return (
    <Layout currentPage="comments">
      {error ? (
        <div className="app-error">{error}</div>
      ) : loading ? (
        <LoadingIndicator label="Loading comments..." />
      ) : (
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
          {moreLink ? (
            <div className="comments-page-more">
              <Link to={moreLink}>More</Link>
            </div>
          ) : null}
        </div>
      )}
    </Layout>
  );
};
