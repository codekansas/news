import type {
  CommentTreeNode,
  FavoriteStatusResponse,
  NotificationsPage,
  PushSubscriptionInput,
  RecentCommentsPage,
  RuntimeConfig,
  SearchStoriesPage,
  Story,
  StoryFeedMode,
  StoryFeedPage,
  StoryListPage,
  StorySummary,
  UpdateUserProfileInput,
  UserProfile,
} from '@news/shared';
import { fetchAuthSession } from 'aws-amplify/auth';

type ApiRequestInit = RequestInit & {
  authenticated?: boolean;
};

type StoryResponse = {
  story: Story;
};

type CommentsResponse = {
  comments: CommentTreeNode[];
};

type ProfileResponse = {
  profile: UserProfile;
};

const buildHeaders = async (init: ApiRequestInit): Promise<HeadersInit | undefined> => {
  const headers = new Headers(init.headers);

  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }

  if (init.authenticated) {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();

    if (!token) {
      throw new Error('You need to log in before doing that.');
    }

    headers.set('authorization', `Bearer ${token}`);
  }

  return headers;
};

const request = async <TResponse>(
  config: RuntimeConfig,
  path: string,
  init: ApiRequestInit = {},
): Promise<TResponse> => {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: await buildHeaders(init),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}.`);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
};

export const listStories = (
  config: RuntimeConfig,
  options: {
    cursor?: string;
    day?: string;
    mode?: StoryFeedMode;
  } = {},
) => {
  const params = new URLSearchParams();

  if (options.cursor) {
    params.set('cursor', options.cursor);
  }

  if (options.day) {
    params.set('day', options.day);
  }

  if (options.mode) {
    params.set('mode', options.mode);
  }

  const query = params.toString();
  return request<StoryFeedPage>(config, `/feed${query ? `?${query}` : ''}`);
};

export const getStory = (config: RuntimeConfig, storyId: string) =>
  request<StoryResponse>(config, `/stories/${storyId}`);

export const getComments = (config: RuntimeConfig, storyId: string) =>
  request<CommentsResponse>(config, `/stories/${storyId}/comments`);

export const listRecentComments = (
  config: RuntimeConfig,
  options: {
    page?: number;
  } = {},
) => {
  const params = new URLSearchParams();

  if (options.page && options.page > 1) {
    params.set('page', String(options.page));
  }

  const query = params.toString();
  return request<RecentCommentsPage>(config, `/comments${query ? `?${query}` : ''}`);
};

export const listUserSubmissions = (
  config: RuntimeConfig,
  username: string,
  options: {
    page?: number;
  } = {},
) => {
  const params = new URLSearchParams();

  if (options.page && options.page > 1) {
    params.set('page', String(options.page));
  }

  const query = params.toString();
  return request<StoryListPage>(
    config,
    `/users/${encodeURIComponent(username)}/submissions${query ? `?${query}` : ''}`,
  );
};

export const listUserComments = (
  config: RuntimeConfig,
  username: string,
  options: {
    page?: number;
  } = {},
) => {
  const params = new URLSearchParams();

  if (options.page && options.page > 1) {
    params.set('page', String(options.page));
  }

  const query = params.toString();
  return request<RecentCommentsPage>(
    config,
    `/users/${encodeURIComponent(username)}/comments${query ? `?${query}` : ''}`,
  );
};

export const listUserFavorites = (
  config: RuntimeConfig,
  username: string,
  options: {
    page?: number;
  } = {},
) => {
  const params = new URLSearchParams();

  if (options.page && options.page > 1) {
    params.set('page', String(options.page));
  }

  const query = params.toString();
  return request<StoryListPage>(
    config,
    `/users/${encodeURIComponent(username)}/favorites${query ? `?${query}` : ''}`,
  );
};

export const searchStories = (
  config: RuntimeConfig,
  options: {
    page?: number;
    query: string;
  },
) => {
  const params = new URLSearchParams();

  if (options.query.trim()) {
    params.set('q', options.query.trim());
  }

  if (options.page && options.page > 1) {
    params.set('page', String(options.page));
  }

  const query = params.toString();
  return request<SearchStoriesPage>(config, `/search${query ? `?${query}` : ''}`);
};

export const postComment = (
  config: RuntimeConfig,
  storyId: string,
  body: { parentId: string | null; text: string },
) =>
  request<void>(config, `/stories/${storyId}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
    authenticated: true,
  });

export const getFavoriteStatus = (config: RuntimeConfig, storyId: string) =>
  request<FavoriteStatusResponse>(config, `/stories/${storyId}/favorite`, {
    authenticated: true,
  });

export const putFavorite = (config: RuntimeConfig, storyId: string) =>
  request<void>(config, `/stories/${storyId}/favorite`, {
    method: 'PUT',
    authenticated: true,
  });

export const deleteFavorite = (config: RuntimeConfig, storyId: string) =>
  request<void>(config, `/stories/${storyId}/favorite`, {
    method: 'DELETE',
    authenticated: true,
  });

export const getCurrentProfile = (config: RuntimeConfig) =>
  request<ProfileResponse>(config, '/me', {
    authenticated: true,
  });

export const updateCurrentProfile = (config: RuntimeConfig, body: UpdateUserProfileInput) =>
  request<ProfileResponse>(config, '/me', {
    method: 'PUT',
    body: JSON.stringify(body),
    authenticated: true,
  });

export const getNotifications = (config: RuntimeConfig) =>
  request<NotificationsPage>(config, '/notifications', {
    authenticated: true,
  });

export const markNotificationsRead = (config: RuntimeConfig) =>
  request<void>(config, '/notifications/read', {
    method: 'POST',
    authenticated: true,
  });

export const putPushSubscription = (config: RuntimeConfig, body: PushSubscriptionInput) =>
  request<void>(config, '/notifications/push-subscription', {
    method: 'PUT',
    body: JSON.stringify(body),
    authenticated: true,
  });

export const deletePushSubscription = (config: RuntimeConfig, endpoint: string) =>
  request<void>(config, '/notifications/push-subscription', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
    authenticated: true,
  });
