import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from '../lib/auth';
import { formatAge, renderCommentText } from '../lib/format';
import { useNotifications } from '../lib/notifications';

export const MailboxPage = () => {
  const location = useLocation();
  const { status } = useAuth();
  const {
    disablePush,
    enablePush,
    error,
    loading,
    markAllRead,
    notifications,
    pushBusy,
    pushEnabled,
    pushPermission,
    pushSupported,
    unreadCount,
  } = useNotifications();

  useEffect(() => {
    if (status === 'authenticated' && unreadCount > 0) {
      void markAllRead();
    }
  }, [markAllRead, status, unreadCount]);

  if (status === 'guest') {
    return (
      <Layout currentPage="mailbox">
        <div className="auth-page">
          <Link to={`/login?goto=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>
            login
          </Link>{' '}
          to view your mailbox.
        </div>
      </Layout>
    );
  }

  if (status === 'loading' || loading) {
    return (
      <Layout currentPage="mailbox">
        <LoadingIndicator label="Loading mailbox..." />
      </Layout>
    );
  }

  const pushStatus = !pushSupported
    ? 'Push notifications are not available in this browser.'
    : pushPermission === 'denied'
      ? 'Push notifications are blocked in this browser. Update your browser settings to re-enable them.'
      : pushEnabled
        ? 'Push notifications are enabled on this browser.'
        : 'Push notifications are off on this browser.';

  return (
    <Layout currentPage="mailbox">
      <div className="mailbox-page">
        <div className="mailbox-page-intro">
          <b>mailbox</b>
        </div>
        <div className="mailbox-page-toolbar">
          <span>{pushStatus}</span>{' '}
          {pushSupported && pushPermission !== 'denied' ? (
            pushEnabled ? (
              <button
                className="plain-link mailbox-action"
                disabled={pushBusy}
                onClick={() => void disablePush()}
                type="button"
              >
                disable push
              </button>
            ) : (
              <button
                className="plain-link mailbox-action"
                disabled={pushBusy}
                onClick={() => void enablePush()}
                type="button"
              >
                enable push
              </button>
            )
          ) : null}
        </div>
        {error ? <div className="app-error">{error}</div> : null}
        {notifications.length === 0 ? (
          <div className="mailbox-page-empty">Replies to your comments will show up here.</div>
        ) : (
          <div className="mailbox-list">
            {notifications.map((notification) => (
              <div
                className={`mailbox-entry ${notification.isRead ? '' : 'mailbox-entry-unread'}`}
                key={notification.notificationId}
              >
                <span className="comhead">
                  <span className="hnuser">{notification.actorUsername}</span> replied to your
                  comment{' '}
                  <span className="age" title={notification.createdAt}>
                    <Link to={notification.url}>{formatAge(notification.createdAt)}</Link>
                  </span>{' '}
                  | <Link to={notification.url}>context</Link> | on:{' '}
                  <Link className="comments-page-story-link" to={`/item/${notification.storyId}`}>
                    {notification.storyTitle}
                  </Link>
                </span>
                <div className="comment mailbox-entry-text">
                  <div className="commtext c00">{renderCommentText(notification.excerpt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
