import type { RuntimeConfig } from '@news/shared';
import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { loadRuntimeConfig } from './lib/runtime-config';
import { HomePage } from './pages/HomePage';
import { ItemPage } from './pages/ItemPage';
import { LoginPage } from './pages/LoginPage';

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
    return <div className="app-loading">Loading…</div>;
  }

  return (
    <AuthProvider config={config}>
      <Routes>
        <Route path="/" element={<HomePage config={config} />} />
        <Route path="/item/:storyId" element={<ItemPage config={config} />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </AuthProvider>
  );
};
