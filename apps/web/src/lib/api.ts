import type {
  CommentTreeNode,
  RuntimeConfig,
  Story,
  StorySummary,
  UserProfile,
} from '@news/shared';
import { fetchAuthSession } from 'aws-amplify/auth';

type ApiRequestInit = RequestInit & {
  authenticated?: boolean;
};

type StoryResponse = {
  story: Story;
};

type FeedResponse = {
  stories: StorySummary[];
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

export const listStories = (config: RuntimeConfig) => request<FeedResponse>(config, '/feed');

export const getStory = (config: RuntimeConfig, storyId: string) =>
  request<StoryResponse>(config, `/stories/${storyId}`);

export const getComments = (config: RuntimeConfig, storyId: string) =>
  request<CommentsResponse>(config, `/stories/${storyId}/comments`);

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

export const getCurrentProfile = (config: RuntimeConfig) =>
  request<ProfileResponse>(config, '/me', {
    authenticated: true,
  });
