import type { MailboxNotification, PushSubscriptionInput, RuntimeConfig } from '@news/shared';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  deletePushSubscription,
  getNotifications,
  markNotificationsRead,
  putPushSubscription,
} from './api';
import { useAuth } from './auth';

type PushPermissionState = 'default' | 'denied' | 'granted' | 'unsupported';

type NotificationsContextValue = {
  disablePush: () => Promise<void>;
  enablePush: () => Promise<void>;
  error: string | null;
  loading: boolean;
  markAllRead: () => Promise<void>;
  notifications: MailboxNotification[];
  pushBusy: boolean;
  pushEnabled: boolean;
  pushPermission: PushPermissionState;
  pushSupported: boolean;
  refresh: () => Promise<void>;
  unreadCount: number;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);
const refreshIntervalMs = 30_000;

const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window;

const toMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = window.atob(padded);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
};

const encodeKey = (value: ArrayBuffer | null, keyName: string) => {
  if (!value) {
    throw new Error(`Push subscription is missing the ${keyName} key.`);
  }

  const encoded = btoa(String.fromCharCode(...new Uint8Array(value)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const toPushSubscriptionInput = (subscription: PushSubscription): PushSubscriptionInput => ({
  endpoint: subscription.endpoint,
  expirationTime: subscription.expirationTime,
  keys: {
    auth: encodeKey(subscription.getKey('auth'), 'auth'),
    p256dh: encodeKey(subscription.getKey('p256dh'), 'p256dh'),
  },
});

const ensureServiceWorkerRegistration = async () => {
  const existingRegistration = await navigator.serviceWorker.getRegistration('/notification-sw.js');
  if (existingRegistration) {
    return existingRegistration;
  }

  return navigator.serviceWorker.register('/notification-sw.js');
};

export const NotificationsProvider = ({
  children,
  config,
}: {
  children: ReactNode;
  config: RuntimeConfig;
}) => {
  const { status } = useAuth();
  const [notifications, setNotifications] = useState<MailboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushSupported, setPushSupported] = useState(isPushSupported());
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(
    isPushSupported() ? Notification.permission : 'unsupported',
  );
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') {
      return;
    }

    const response = await getNotifications(config);
    if (!mountedRef.current) {
      return;
    }

    setNotifications(response.notifications);
    setUnreadCount(response.unreadCount);
  }, [config, status]);

  const refreshPushState = useCallback(async () => {
    const supported = isPushSupported();
    if (!mountedRef.current) {
      return null;
    }

    setPushSupported(supported);
    setPushPermission(supported ? Notification.permission : 'unsupported');

    if (!supported) {
      setPushEnabled(false);
      return null;
    }

    const registration = await ensureServiceWorkerRegistration();
    const subscription = await registration.pushManager.getSubscription();

    if (!mountedRef.current) {
      return null;
    }

    setPushEnabled(Boolean(subscription));
    return subscription;
  }, []);

  const markAllRead = async () => {
    if (status !== 'authenticated' || unreadCount === 0) {
      return;
    }

    await markNotificationsRead(config);
    if (!mountedRef.current) {
      return;
    }

    const readAt = new Date().toISOString();
    setUnreadCount(0);
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt ?? readAt,
      })),
    );
  };

  const enablePush = async () => {
    if (status !== 'authenticated') {
      throw new Error('You need to log in before enabling push notifications.');
    }

    if (!isPushSupported()) {
      throw new Error('This browser does not support push notifications.');
    }

    setPushBusy(true);
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission !== 'granted') {
        throw new Error('Browser notification permission was not granted.');
      }

      const registration = await ensureServiceWorkerRegistration();
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          applicationServerKey: decodeBase64Url(config.pushPublicKey),
          userVisibleOnly: true,
        }));

      await putPushSubscription(config, toPushSubscriptionInput(subscription));

      if (!mountedRef.current) {
        return;
      }

      setPushEnabled(true);
    } catch (pushError) {
      if (!mountedRef.current) {
        return;
      }

      setError(toMessage(pushError));
      throw pushError;
    } finally {
      if (mountedRef.current) {
        setPushBusy(false);
      }
    }
  };

  const disablePush = async () => {
    if (status !== 'authenticated' || !isPushSupported()) {
      return;
    }

    setPushBusy(true);
    setError(null);

    try {
      const registration = await ensureServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        if (mountedRef.current) {
          setPushEnabled(false);
        }
        return;
      }

      await deletePushSubscription(config, subscription.endpoint);
      await subscription.unsubscribe();

      if (!mountedRef.current) {
        return;
      }

      setPushEnabled(false);
    } catch (pushError) {
      if (!mountedRef.current) {
        return;
      }

      setError(toMessage(pushError));
      throw pushError;
    } finally {
      if (mountedRef.current) {
        setPushBusy(false);
      }
    }
  };

  useEffect(() => {
    if (status !== 'authenticated') {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setError(null);
      void refreshPushState();
      return;
    }

    let cancelled = false;

    const loadNotifications = async (showLoading: boolean) => {
      if (showLoading && mountedRef.current) {
        setLoading(true);
      }

      try {
        await refresh();
        if (!cancelled) {
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled && mountedRef.current) {
          setError(toMessage(loadError));
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    void loadNotifications(true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadNotifications(false);
      }
    }, refreshIntervalMs);

    const onFocus = () => {
      void loadNotifications(false);
    };

    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh, refreshPushState, status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    let cancelled = false;

    if (!isPushSupported()) {
      void refreshPushState();
      return;
    }

    const syncPushSubscription = async () => {
      try {
        const subscription = await refreshPushState();
        if (!subscription || Notification.permission !== 'granted') {
          return;
        }

        await putPushSubscription(config, toPushSubscriptionInput(subscription));
      } catch (syncError) {
        if (!cancelled && mountedRef.current) {
          setError(toMessage(syncError));
        }
      }
    };

    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'notification-pushed') {
        void refresh();
      }
    };

    void syncPushSubscription();
    navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
    };
  }, [config, refresh, refreshPushState, status]);

  const value: NotificationsContextValue = {
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
    refresh,
    unreadCount,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider.');
  }
  return context;
};
