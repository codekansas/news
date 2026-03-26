import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useNotifications } from '../lib/notifications';
import { LoadingIndicator } from './LoadingIndicator';
import { MailboxIcon } from './MailboxIcon';

export const Layout = ({
  children,
  currentPage,
  headerRight,
}: {
  children: ReactNode;
  currentPage:
    | 'changepw'
    | 'comments'
    | 'favorites'
    | 'flagged'
    | 'home'
    | 'item'
    | 'mailbox'
    | 'past'
    | 'search'
    | 'submitted'
    | 'threads'
    | 'upvoted'
    | 'user';
  headerRight?: ReactNode;
}) => {
  const { profile, status, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const goto = `${location.pathname}${location.search}`;
  const footerSearchQuery = new URLSearchParams(location.search).get('q') ?? '';
  const topColor = status === 'authenticated' && profile ? `#${profile.topcolor}` : '#ff6600';
  const accountLinks =
    status === 'loading' ? (
      <LoadingIndicator compact inline label="loading" />
    ) : status === 'authenticated' && profile ? (
      <>
        <Link
          aria-label={
            unreadCount > 0 ? `${unreadCount} unread notifications` : 'Open notification mailbox'
          }
          className={`mailbox-link ${unreadCount > 0 ? 'mailbox-link-unread' : ''}`}
          to="/mailbox"
        >
          <MailboxIcon unread={unreadCount > 0} />
          {unreadCount > 0 ? <span className="mailbox-badge">{unreadCount}</span> : null}
        </Link>{' '}
        | <Link to={`/user?id=${encodeURIComponent(profile.username)}`}>{profile.username}</Link> |{' '}
        <button className="link-button pagetop-button" onClick={() => void logout()} type="button">
          logout
        </button>
      </>
    ) : (
      <Link to={`/login?goto=${encodeURIComponent(goto)}`}>login</Link>
    );

  return (
    <center>
      <table
        border={0}
        cellPadding={0}
        cellSpacing={0}
        id="hnmain"
        style={{ backgroundColor: '#f6f6ef' }}
        width="85%"
      >
        <tbody>
          <tr>
            <td style={{ backgroundColor: topColor }}>
              <table border={0} cellPadding={0} cellSpacing={0} width="100%" style={{ padding: 2 }}>
                <tbody>
                  <tr>
                    <td style={{ width: 18, paddingRight: 4 }}>
                      <Link to="/">
                        <img
                          alt="AI News"
                          height="18"
                          src="/ai18.svg"
                          style={{ border: '1px white solid', display: 'block' }}
                          width="18"
                        />
                      </Link>
                    </td>
                    <td style={{ lineHeight: '12pt', height: 10 }}>
                      <span className="pagetop">
                        <b className="hnname">
                          <Link to="/">AI News</Link>
                        </b>
                        <Link className={currentPage === 'home' ? 'topsel' : undefined} to="/">
                          new
                        </Link>{' '}
                        {status === 'authenticated' && profile ? (
                          <>
                            |{' '}
                            <Link
                              className={currentPage === 'threads' ? 'topsel' : undefined}
                              to={`/threads?id=${encodeURIComponent(profile.username)}`}
                            >
                              threads
                            </Link>{' '}
                          </>
                        ) : null}
                        |{' '}
                        <Link className={currentPage === 'past' ? 'topsel' : undefined} to="/past">
                          past
                        </Link>{' '}
                        |{' '}
                        <Link
                          className={currentPage === 'comments' ? 'topsel' : undefined}
                          to="/comments"
                        >
                          comments
                        </Link>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 4 }}>
                      <span className="pagetop">
                        {headerRight}
                        {headerRight && status === 'guest' ? null : headerRight ? ' | ' : null}
                        {headerRight && status === 'guest' ? null : accountLinks}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr style={{ height: 10 }} />
          <tr id="bigbox">
            <td>{children}</td>
          </tr>
          <tr>
            <td>
              <img alt="" height="10" src="/ai18.svg" style={{ visibility: 'hidden' }} width="0" />
              <table cellPadding={1} cellSpacing={0} width="100%">
                <tbody>
                  <tr>
                    <td style={{ backgroundColor: '#ff6600' }} />
                  </tr>
                </tbody>
              </table>
              <br />
              <center>
                <span className="yclinks">
                  <a
                    href="https://news.ycombinator.com/newsguidelines.html"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Guidelines
                  </a>{' '}
                  |{' '}
                  <a
                    href="https://news.ycombinator.com/newsfaq.html"
                    rel="noreferrer"
                    target="_blank"
                  >
                    FAQ
                  </a>{' '}
                  |{' '}
                  <a href="https://github.com/HackerNews/API" rel="noreferrer" target="_blank">
                    API
                  </a>{' '}
                  | <a href="mailto:ben@bolte.cc">Contact</a>
                </span>
                <br />
                <br />
                <form action="/search" method="get">
                  Search:{' '}
                  <input
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    defaultValue={footerSearchQuery}
                    key={footerSearchQuery}
                    name="q"
                    size={17}
                    spellCheck={false}
                    type="text"
                  />
                </form>
              </center>
            </td>
          </tr>
        </tbody>
      </table>
    </center>
  );
};
