import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export const Layout = ({
  children,
  currentPage,
}: {
  children: ReactNode;
  currentPage: 'home' | 'item';
}) => {
  const { profile, status, logout } = useAuth();
  const location = useLocation();

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
            <td style={{ backgroundColor: '#ff6600' }}>
              <table border={0} cellPadding={0} cellSpacing={0} width="100%" style={{ padding: 2 }}>
                <tbody>
                  <tr>
                    <td style={{ width: 18, paddingRight: 4 }}>
                      <Link to="/">
                        <img
                          alt="Hacker News"
                          height="18"
                          src="/y18.svg"
                          style={{ border: '1px white solid', display: 'block' }}
                          width="18"
                        />
                      </Link>
                    </td>
                    <td style={{ lineHeight: '12pt', height: 10 }}>
                      <span className="pagetop">
                        <b className="hnname">
                          <Link to="/">Hacker News</Link>
                        </b>
                        <Link className={currentPage === 'home' ? 'topsel' : undefined} to="/">
                          new
                        </Link>{' '}
                        | <Link to="/">past</Link> | <Link to="/">comments</Link> |{' '}
                        <Link to="/">ask</Link> | <Link to="/">show</Link> |{' '}
                        <Link to="/">jobs</Link> | <Link to="/">submit</Link>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 4 }}>
                      <span className="pagetop">
                        {status === 'authenticated' && profile ? (
                          <>
                            <span>{profile.username}</span> |{' '}
                            <button
                              className="link-button pagetop-button"
                              onClick={() => void logout()}
                              type="button"
                            >
                              logout
                            </button>
                          </>
                        ) : (
                          <Link to={`/login?goto=${encodeURIComponent(location.pathname)}`}>
                            login
                          </Link>
                        )}
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
              <img alt="" height="10" src="/y18.svg" style={{ visibility: 'hidden' }} width="0" />
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
                <form action="https://hn.algolia.com/" method="get">
                  Search:{' '}
                  <input
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
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
