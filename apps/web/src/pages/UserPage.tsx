import type {
  RuntimeConfig,
  UpdateUserProfileInput,
  UserPreferenceSetting,
  UserProfile,
} from '@news/shared';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { updateCurrentProfile } from '../lib/api';
import { useAuth } from '../lib/auth';

type UserPageFormState = {
  username: string;
  name: string;
  about: string;
  email: string;
  showdead: UserPreferenceSetting;
  noprocrast: UserPreferenceSetting;
  maxvisit: string;
  minaway: string;
  topcolor: string;
  delay: string;
};

const parseRequestedUser = (search: string) => new URLSearchParams(search).get('id');

const buildFormState = (profile: UserProfile): UserPageFormState => ({
  username: profile.username,
  name: profile.name,
  about: profile.about,
  email: profile.email,
  showdead: profile.showdead,
  noprocrast: profile.noprocrast,
  maxvisit: String(profile.maxvisit),
  minaway: String(profile.minaway),
  topcolor: profile.topcolor,
  delay: String(profile.delay),
});

const formatCreatedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const buildProfileLink = (
  pathname: string,
  username: string,
  extraParams?: Record<string, string>,
) => {
  const params = new URLSearchParams({
    id: username,
  });

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      params.set(key, value);
    }
  }

  return `${pathname}?${params.toString()}`;
};

export const UserPage = ({ config }: { config: RuntimeConfig }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, refreshProfile, status } = useAuth();
  const requestedUsername = useMemo(() => parseRequestedUser(location.search), [location.search]);
  const [formState, setFormState] = useState<UserPageFormState | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormState(buildFormState(profile));
      setCurrentUsername(profile.username);
    }
  }, [profile]);

  if (status === 'guest') {
    return (
      <Layout currentPage="user">
        <div className="auth-page">
          <Link to={`/login?goto=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>
            login
          </Link>{' '}
          to edit your user page.
        </div>
      </Layout>
    );
  }

  if (status === 'loading' || !profile || !formState) {
    return (
      <Layout currentPage="user">
        <LoadingIndicator label="Loading user..." />
      </Layout>
    );
  }

  if (requestedUsername && requestedUsername !== (currentUsername ?? profile.username)) {
    return (
      <Layout currentPage="user">
        <div className="auth-page">No such user.</div>
      </Layout>
    );
  }

  const updateFormField = <TField extends keyof UserPageFormState>(
    field: TField,
    value: UserPageFormState[TField],
  ) => {
    setFormState((currentState) =>
      currentState
        ? {
            ...currentState,
            [field]: value,
          }
        : currentState,
    );
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const input: UpdateUserProfileInput = {
      username: formState.username,
      name: formState.name,
      about: formState.about,
      email: formState.email,
      showdead: formState.showdead,
      noprocrast: formState.noprocrast,
      maxvisit: Number.parseInt(formState.maxvisit, 10),
      minaway: Number.parseInt(formState.minaway, 10),
      topcolor: formState.topcolor,
      delay: Number.parseInt(formState.delay, 10),
    };

    try {
      const response = await updateCurrentProfile(config, input);
      setFormState(buildFormState(response.profile));
      setCurrentUsername(response.profile.username);
      navigate(buildProfileLink('/user', response.profile.username), { replace: true });
      await refreshProfile();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout currentPage="user">
      <div className="user-page">
        {error ? <div className="app-error">{error}</div> : null}
        <form onSubmit={onSubmit}>
          <table border={0} cellPadding={0} cellSpacing={0} className="hn-user-table">
            <tbody>
              <tr>
                <td className="hn-user-label">user:</td>
                <td className="hn-user-field-cell">
                  <input
                    className="hn-user-input-medium"
                    onChange={(event) => updateFormField('username', event.target.value)}
                    size={20}
                    spellCheck={false}
                    type="text"
                    value={formState.username}
                  />
                </td>
              </tr>
              <tr>
                <td className="hn-user-label">name:</td>
                <td className="hn-user-field-cell">
                  <input
                    className="hn-user-input-wide"
                    onChange={(event) => updateFormField('name', event.target.value)}
                    size={60}
                    spellCheck={false}
                    type="text"
                    value={formState.name}
                  />
                </td>
              </tr>
              <tr>
                <td className="hn-user-label">bio:</td>
                <td className="hn-user-muted-value">{profile.bio || <span>&nbsp;</span>}</td>
              </tr>
              <tr>
                <td className="hn-user-label">created:</td>
                <td className="hn-user-value">{formatCreatedAt(profile.createdAt)}</td>
              </tr>
              <tr>
                <td className="hn-user-label">karma:</td>
                <td className="hn-user-muted-value">{profile.karma}</td>
              </tr>
              <tr>
                <td className="hn-user-label">about:</td>
                <td className="hn-user-field-cell" colSpan={2}>
                  <div className="hn-user-about-wrap">
                    <textarea
                      className="hn-user-textarea"
                      cols={60}
                      onChange={(event) => updateFormField('about', event.target.value)}
                      rows={9}
                      spellCheck={false}
                      value={formState.about}
                      wrap="virtual"
                    />
                    <span className="hn-user-help">
                      <a
                        href="https://news.ycombinator.com/formatdoc"
                        rel="noreferrer"
                        target="_blank"
                      >
                        help
                      </a>
                    </span>
                  </div>
                </td>
              </tr>
              <tr>
                <td />
                <td className="hn-user-field-cell hn-user-note" colSpan={2}>
                  Only admins see your email below. To share publicly, add to the &apos;about&apos;{' '}
                  box.
                </td>
              </tr>
              <tr>
                <td className="hn-user-label">email:</td>
                <td className="hn-user-field-cell">
                  <input
                    className="hn-user-input-wide"
                    onChange={(event) => updateFormField('email', event.target.value)}
                    size={60}
                    spellCheck={false}
                    type="email"
                    value={formState.email}
                  />
                </td>
              </tr>
              <tr>
                <td className="hn-user-label">showdead:</td>
                <td>
                  <select
                    onChange={(event) =>
                      updateFormField('showdead', event.target.value as UserPreferenceSetting)
                    }
                    value={formState.showdead}
                  >
                    <option value="no">no</option>
                    <option value="yes">yes</option>
                  </select>
                </td>
              </tr>
              <tr>
                <td className="hn-user-label">noprocrast:</td>
                <td>
                  <select
                    onChange={(event) =>
                      updateFormField('noprocrast', event.target.value as UserPreferenceSetting)
                    }
                    value={formState.noprocrast}
                  >
                    <option value="no">no</option>
                    <option value="yes">yes</option>
                  </select>
                </td>
              </tr>
              <tr>
                <td className="hn-user-label">maxvisit:</td>
                <td>
                  <input
                    className="hn-user-input-medium"
                    onChange={(event) => updateFormField('maxvisit', event.target.value)}
                    size={7}
                    spellCheck={false}
                    type="text"
                    value={formState.maxvisit}
                  />
                </td>
              </tr>
              <tr>
                <td className="hn-user-label">minaway:</td>
                <td>
                  <input
                    className="hn-user-input-medium"
                    onChange={(event) => updateFormField('minaway', event.target.value)}
                    size={7}
                    spellCheck={false}
                    type="text"
                    value={formState.minaway}
                  />
                </td>
              </tr>
              <tr>
                <td className="hn-user-label">topcolor:</td>
                <td>
                  <input
                    className="hn-user-input-color"
                    onChange={(event) => updateFormField('topcolor', event.target.value)}
                    size={7}
                    spellCheck={false}
                    type="text"
                    value={formState.topcolor}
                  />
                </td>
              </tr>
              <tr>
                <td className="hn-user-label">delay:</td>
                <td>
                  <input
                    className="hn-user-input-medium"
                    onChange={(event) => updateFormField('delay', event.target.value)}
                    size={7}
                    spellCheck={false}
                    type="text"
                    value={formState.delay}
                  />
                </td>
              </tr>
              <tr>
                <td />
                <td className="hn-user-links">
                  <Link to={buildProfileLink('/changepw', currentUsername ?? profile.username)}>
                    change password
                  </Link>
                  <br />
                  <Link to={buildProfileLink('/threads', currentUsername ?? profile.username)}>
                    comments
                  </Link>
                  <br />
                  <Link to={buildProfileLink('/favorites', currentUsername ?? profile.username)}>
                    favorite articles
                  </Link>{' '}
                  <span className="hn-user-annotation">(publicly visible)</span>
                </td>
              </tr>
              <tr>
                <td />
                <td className="hn-user-submit">
                  <input disabled={saving} type="submit" value="update" />
                  {saving ? (
                    <>
                      {' '}
                      <LoadingIndicator compact inline label="Saving..." />
                    </>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>
        </form>
      </div>
    </Layout>
  );
};
