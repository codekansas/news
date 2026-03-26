import { updatePassword } from 'aws-amplify/auth';
import { type FormEvent, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from '../lib/auth';

const parseUsername = (search: string) => new URLSearchParams(search).get('id')?.trim() ?? '';

export const ChangePasswordPage = () => {
  const location = useLocation();
  const { profile, status } = useAuth();
  const username = useMemo(() => parseUsername(location.search), [location.search]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  if (status === 'guest') {
    return (
      <Layout currentPage="changepw">
        <div className="auth-page">
          <Link to={`/login?goto=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>
            login
          </Link>{' '}
          to change your password.
        </div>
      </Layout>
    );
  }

  if (status === 'loading' || !profile) {
    return (
      <Layout currentPage="changepw">
        <LoadingIndicator label="Loading account..." />
      </Layout>
    );
  }

  if (!username || username !== profile.username) {
    return (
      <Layout currentPage="changepw">
        <div className="auth-page">Can&apos;t display that.</div>
      </Layout>
    );
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage('');

    if (!currentPassword || !newPassword) {
      setError('Both password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      await updatePassword({
        oldPassword: currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password updated.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout currentPage="changepw">
      <div className="activity-page-intro">Change password</div>
      <form className="change-password-page" onSubmit={onSubmit}>
        <table border={0} cellPadding={0} cellSpacing={0} className="change-password-table">
          <tbody>
            <tr>
              <td className="hn-user-label">current:</td>
              <td>
                <input
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  size={20}
                  type="password"
                  value={currentPassword}
                />
              </td>
            </tr>
            <tr>
              <td className="hn-user-label">new:</td>
              <td>
                <input
                  autoComplete="new-password"
                  onChange={(event) => setNewPassword(event.target.value)}
                  size={20}
                  type="password"
                  value={newPassword}
                />
              </td>
            </tr>
            <tr>
              <td className="hn-user-label">repeat:</td>
              <td>
                <input
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  size={20}
                  type="password"
                  value={confirmPassword}
                />
              </td>
            </tr>
            <tr>
              <td />
              <td className="change-password-submit">
                <input disabled={saving} type="submit" value="change password" />
                {saving ? (
                  <>
                    {' '}
                    <LoadingIndicator compact inline label="Updating..." />
                  </>
                ) : null}
              </td>
            </tr>
          </tbody>
        </table>
      </form>
      {message ? <div className="auth-message change-password-page">{message}</div> : null}
      {error ? <div className="app-error change-password-page">{error}</div> : null}
    </Layout>
  );
};
