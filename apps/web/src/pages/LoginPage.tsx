import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

type AuthMode = 'login' | 'register' | 'confirm';

const parseGoto = (search: string) => {
  const params = new URLSearchParams(search);
  return params.get('goto') || '/';
};

export const LoginPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, confirmRegistration, pendingEmail, error, clearError } = useAuth();
  const goto = useMemo(() => parseGoto(location.search), [location.search]);
  const [email, setEmail] = useState(pendingEmail);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<AuthMode>(pendingEmail ? 'confirm' : 'login');
  const [message, setMessage] = useState('');

  const onLogin = async () => {
    await login(email, password);
    navigate(goto);
  };

  const onRegister = async () => {
    await register(email, password);
    setMode('confirm');
    setMessage(`Check ${email} for the verification code.`);
  };

  const onConfirm = async () => {
    await confirmRegistration(email, code);
    setMode('login');
    setMessage('Account confirmed. You can log in now.');
  };

  return (
    <div className="auth-page">
      <b>Login</b>
      <br />
      <br />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          clearError();
          void onLogin();
        }}
      >
        <table border={0}>
          <tbody>
            <tr>
              <td>email:</td>
              <td>
                <input
                  autoCapitalize="off"
                  autoCorrect="off"
                  onChange={(event) => setEmail(event.target.value)}
                  size={20}
                  spellCheck={false}
                  type="email"
                  value={email}
                />
              </td>
            </tr>
            <tr>
              <td>password:</td>
              <td>
                <input
                  onChange={(event) => setPassword(event.target.value)}
                  size={20}
                  type="password"
                  value={password}
                />
              </td>
            </tr>
          </tbody>
        </table>
        <br />
        <input type="submit" value="login" />
      </form>
      <button className="plain-link" onClick={() => setMode('register')} type="button">
        Need an account?
      </button>
      <br />
      <br />
      <b>Create Account</b>
      <br />
      <br />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          clearError();
          void onRegister();
        }}
      >
        <table border={0}>
          <tbody>
            <tr>
              <td>email:</td>
              <td>
                <input
                  autoCapitalize="off"
                  autoCorrect="off"
                  onChange={(event) => setEmail(event.target.value)}
                  size={20}
                  spellCheck={false}
                  type="email"
                  value={email}
                />
              </td>
            </tr>
            <tr>
              <td>password:</td>
              <td>
                <input
                  onChange={(event) => setPassword(event.target.value)}
                  size={20}
                  type="password"
                  value={password}
                />
              </td>
            </tr>
          </tbody>
        </table>
        <br />
        <input type="submit" value="create account" />
      </form>
      {mode === 'confirm' ? (
        <>
          <br />
          <b>Confirm Account</b>
          <br />
          <br />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              clearError();
              void onConfirm();
            }}
          >
            <table border={0}>
              <tbody>
                <tr>
                  <td>email:</td>
                  <td>
                    <input
                      autoCapitalize="off"
                      autoCorrect="off"
                      onChange={(event) => setEmail(event.target.value)}
                      size={20}
                      spellCheck={false}
                      type="email"
                      value={email}
                    />
                  </td>
                </tr>
                <tr>
                  <td>code:</td>
                  <td>
                    <input
                      onChange={(event) => setCode(event.target.value)}
                      size={20}
                      value={code}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <br />
            <input type="submit" value="confirm account" />
          </form>
        </>
      ) : null}
      {message ? (
        <>
          <br />
          <div className="auth-message">{message}</div>
        </>
      ) : null}
      {error ? (
        <>
          <br />
          <div className="auth-error">{error}</div>
        </>
      ) : null}
    </div>
  );
};
