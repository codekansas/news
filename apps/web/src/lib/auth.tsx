import type { RuntimeConfig, UserProfile } from '@news/shared';
import { Amplify } from 'aws-amplify';
import { confirmSignUp, getCurrentUser, signIn, signOut, signUp } from 'aws-amplify/auth';
import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react';
import { getCurrentProfile } from './api';

type AuthContextValue = {
  profile: UserProfile | null;
  status: 'loading' | 'guest' | 'authenticated';
  pendingEmail: string;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  confirmRegistration: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const configureAmplify = (config: RuntimeConfig) => {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        loginWith: {
          email: true,
        },
      },
    },
  });
};

const toMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';

export const AuthProvider = ({
  children,
  config,
}: {
  children: ReactNode;
  config: RuntimeConfig;
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'guest' | 'authenticated'>('loading');
  const [pendingEmail, setPendingEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const configured = useRef(false);

  const refreshProfile = async () => {
    const response = await getCurrentProfile(config);
    setProfile(response.profile);
    setStatus('authenticated');
  };

  useEffect(() => {
    if (!configured.current) {
      configureAmplify(config);
      configured.current = true;
    }

    let cancelled = false;

    const bootstrapAuth = async () => {
      try {
        await getCurrentUser();
        if (!cancelled) {
          const response = await getCurrentProfile(config);
          setProfile(response.profile);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setStatus('guest');
        }
      }
    };

    void bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [config]);

  const login = async (email: string, password: string) => {
    setError(null);
    await signIn({ username: email, password });
    setPendingEmail('');
    await refreshProfile();
  };

  const register = async (email: string, password: string) => {
    setError(null);
    await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
        },
      },
    });
    setPendingEmail(email);
    setStatus('guest');
  };

  const confirmRegistration = async (email: string, code: string) => {
    setError(null);
    await confirmSignUp({
      username: email,
      confirmationCode: code,
    });
    setPendingEmail(email);
  };

  const logout = async () => {
    setError(null);
    await signOut();
    setProfile(null);
    setStatus('guest');
  };

  const value: AuthContextValue = {
    profile,
    status,
    pendingEmail,
    error,
    login: async (email, password) => {
      try {
        await login(email, password);
      } catch (authError) {
        setError(toMessage(authError));
        throw authError;
      }
    },
    register: async (email, password) => {
      try {
        await register(email, password);
      } catch (authError) {
        setError(toMessage(authError));
        throw authError;
      }
    },
    confirmRegistration: async (email, code) => {
      try {
        await confirmRegistration(email, code);
      } catch (authError) {
        setError(toMessage(authError));
        throw authError;
      }
    },
    logout: async () => {
      try {
        await logout();
      } catch (authError) {
        setError(toMessage(authError));
        throw authError;
      }
    },
    refreshProfile: async () => {
      try {
        await refreshProfile();
      } catch (authError) {
        setError(toMessage(authError));
        throw authError;
      }
    },
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
};
