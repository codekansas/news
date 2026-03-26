import type { RuntimeConfig } from '@news/shared';
import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LoadingIndicator } from './components/LoadingIndicator';
import { AuthProvider } from './lib/auth';
import { NotificationsProvider } from './lib/notifications';
import { loadRuntimeConfig } from './lib/runtime-config';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { CommentsPage } from './pages/CommentsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { HomePage } from './pages/HomePage';
import { ItemPage } from './pages/ItemPage';
import { LoginPage } from './pages/LoginPage';
import { MailboxPage } from './pages/MailboxPage';
import { PastPage } from './pages/PastPage';
import { SearchPage } from './pages/SearchPage';
import { ThreadsPage } from './pages/ThreadsPage';
import { UserPage } from './pages/UserPage';

export const App = () => {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadRuntimeConfig()
      .then((loadedConfig) => {
        if (!cancelled) {
          setConfig(loadedConfig);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Unable to load runtime config.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <div className="app-error">{error}</div>;
  }

  if (!config) {
    return <LoadingIndicator label="Loading site..." />;
  }

  return (
    <AuthProvider config={config}>
      <NotificationsProvider config={config}>
        <Routes>
          <Route path="/" element={<HomePage config={config} />} />
          <Route path="/changepw" element={<ChangePasswordPage />} />
          <Route path="/comments" element={<CommentsPage config={config} />} />
          <Route path="/favorites" element={<FavoritesPage config={config} />} />
          <Route path="/item/:storyId" element={<ItemPage config={config} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/mailbox" element={<MailboxPage />} />
          <Route path="/past" element={<PastPage config={config} />} />
          <Route path="/search" element={<SearchPage config={config} />} />
          <Route path="/threads" element={<ThreadsPage config={config} />} />
          <Route path="/user" element={<UserPage config={config} />} />
        </Routes>
      </NotificationsProvider>
    </AuthProvider>
  );
};
