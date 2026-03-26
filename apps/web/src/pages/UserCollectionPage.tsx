import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../lib/auth';

const parseUsername = (search: string) => new URLSearchParams(search).get('id')?.trim() ?? '';

const isCommentsView = (pathname: string, search: string) => {
  const params = new URLSearchParams(search);

  if (pathname === '/flagged') {
    return params.get('kind') === 'comments';
  }

  return params.get('comments') === 't';
};

const buildTitle = (pathname: string, commentsView: boolean) => {
  const noun = commentsView ? 'comments' : 'submissions';

  switch (pathname) {
    case '/favorites':
      return `favorite ${noun}`;
    case '/flagged':
      return `flagged ${noun}`;
    case '/upvoted':
      return `upvoted ${noun}`;
    default:
      return noun;
  }
};

export const UserCollectionPage = () => {
  const location = useLocation();
  const { profile, status } = useAuth();
  const username = useMemo(() => parseUsername(location.search), [location.search]);
  const commentsView = useMemo(
    () => isCommentsView(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const title = useMemo(
    () => buildTitle(location.pathname, commentsView),
    [commentsView, location.pathname],
  );
  const currentPage =
    location.pathname === '/favorites'
      ? 'favorites'
      : location.pathname === '/flagged'
        ? 'flagged'
        : 'upvoted';
  const requiresOwner = currentPage === 'flagged' || currentPage === 'upvoted';

  if (!username) {
    return (
      <Layout currentPage={currentPage}>
        <div className="app-error">Missing user id.</div>
      </Layout>
    );
  }

  if (requiresOwner && status === 'guest') {
    return (
      <Layout currentPage={currentPage}>
        <div className="auth-page">
          <Link to={`/login?goto=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>
            login
          </Link>{' '}
          to view {title}.
        </div>
      </Layout>
    );
  }

  if (requiresOwner && profile?.username !== username) {
    return (
      <Layout currentPage={currentPage}>
        <div className="auth-page">Can&apos;t display that.</div>
      </Layout>
    );
  }

  return (
    <Layout currentPage={currentPage}>
      <div className="activity-page-intro">
        {title} for {username}
      </div>
      <div className="activity-page-empty">No {title}.</div>
      <div className="activity-page-note">
        AI News does not record this list yet, but the route now resolves correctly.
      </div>
    </Layout>
  );
};
