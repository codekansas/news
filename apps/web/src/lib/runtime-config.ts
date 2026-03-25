import type { RuntimeConfig } from '@news/shared';

let runtimeConfigPromise: Promise<RuntimeConfig> | null = null;

export const loadRuntimeConfig = async (): Promise<RuntimeConfig> => {
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch('/runtime-config.json', {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
      },
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Runtime config request failed with ${response.status}.`);
      }

      return (await response.json()) as RuntimeConfig;
    });
  }

  return runtimeConfigPromise;
};
